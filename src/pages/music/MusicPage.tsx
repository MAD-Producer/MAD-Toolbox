import { IconAdjustmentsHorizontal, IconAlertTriangle, IconListDetails, IconLoader2 } from "@tabler/icons-react";
import { notifications } from "../../lib/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SettingsSection } from "../../components/common/SettingsSection";
import { L2TabNav } from "../../components/common/L2TabNav";
import { Card } from "../../components/ui/card";
import { t } from "../../locale";
import { MusicAdvancedSettings } from "./MusicAdvancedSettings";
import { MusicCommandPanel } from "./MusicCommandPanel";
import { MusicConfigurationPanel } from "./MusicConfigurationPanel";
import { MusicPageHeader } from "./MusicPageHeader";
import { MusicSearchResults } from "./MusicSearchResults";
import { MusicSourcePicker } from "./MusicSourcePicker";
import type { DependencyStatus } from "../../contracts/dependency";
import type { CookieFileOption, TaskSeed } from "../../contracts/types";
import { loadStoredForm, saveStoredForm } from "../../lib/formStorage";
import { isSearchBusy, useMusicSessionStore } from "../../stores/music-session";
import { musicdlDownload, musicdlPlaylist, previewMusicCommand } from "./api";
import {
  createInitialMusicForm,
  createMusicPlaylistRequest,
  createMusicSearchRequest,
  MUSIC_SOURCE_GROUPS,
  prepareMusicConfiguration,
  type MusicFormPatch,
  type MusicFormState
} from "./configuration";

const MUSIC_PREVIEW_DEBOUNCE_MS = 180;
const MUSIC_FORM_STORAGE_KEY = "music.form";
const MUSIC_LEGACY_SOURCES_STORAGE_KEY = "music.selectedSources";
const MUSIC_DENOISE_STORAGE_KEY = "music.autoDenoise";

const KNOWN_MUSIC_SOURCE_IDS = new Set(
  MUSIC_SOURCE_GROUPS.flatMap(([, sources]) => sources.map(([id]) => id))
);

function createPersistedMusicForm(): MusicFormState {
  const form = loadStoredForm(
    MUSIC_FORM_STORAGE_KEY,
    createInitialMusicForm()
  ) as MusicFormState & {
    cookies?: string;
  };
  // "cookies" 是旧版明文 Cookie 字段：升级用户的存量 localStorage 里仍有明文，
  // 剔除后随首次保存覆写，不再进入表单状态与持久化（后端快照兜底见 FORM_SNAPSHOT_SENSITIVE_FIELDS）
  delete form.cookies;
  if (localStorage.getItem(MUSIC_FORM_STORAGE_KEY) !== null) return form;
  try {
    const saved = JSON.parse(
      localStorage.getItem(MUSIC_LEGACY_SOURCES_STORAGE_KEY) ?? "null"
    ) as unknown;
    if (Array.isArray(saved)) {
      form.sources = saved.filter(
        (id): id is string => typeof id === "string" && KNOWN_MUSIC_SOURCE_IDS.has(id)
      );
    }
  } catch {}
  return form;
}

interface MusicPreviewResult {
  display: string | null;
  error: string | null;
}

interface MusicPageProps {
  active: boolean;
  seed?: TaskSeed | null;
  dependency: DependencyStatus | null;
  pythonDependency: DependencyStatus | null;
  defaultOutputDirectory: string | null;
  globalProxy: string | null;
  onRetain?: () => void;
  onSubmitted?: () => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
  cookieFiles: CookieFileOption[];
  onAddCookieFile?: () => void;
}

export function MusicPage({
  active,
  seed,
  dependency,
  pythonDependency,
  defaultOutputDirectory,
  globalProxy,
  onRetain,
  onSubmitted,
  dependencyLabels,
  onOpenDependencies,
  cookieFiles,
  onAddCookieFile
}: MusicPageProps) {
  // 任务种子只在挂载时消费一次（deliver → generation+1 → 重挂）
  const seedFormSnapshot =
    seed?.task.intent.type === "form"
      ? ((seed.task.intent.data.form ?? {}) as Partial<MusicFormState>)
      : null;
  const seedMode: MusicFormState["mode"] =
    seed?.task.intent.type === "form" && seed.task.intent.data.musicdl === "playlist"
      ? "playlist"
      : "search";
  const seedDenoise =
    seed?.task.intent.type === "form" && typeof seed.task.intent.data.denoise === "boolean"
      ? seed.task.intent.data.denoise
      : null;
  const [form, setForm] = useState<MusicFormState>(() => {
    if (seed) {
      return {
        ...createInitialMusicForm(),
        ...seedFormSnapshot,
        mode: seedFormSnapshot?.mode ?? seedMode,
        keyword: "",
        playlistUrl: ""
      };
    }
    return createPersistedMusicForm();
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // 结果面板展开状态：收起是用户显式操作，展开由「发起搜索」事件驱动
  //（原先用 Effect 观察 searchResponse 到达再展开，发起时即展开，搜索中就有反馈）
  const [resultsCollapsed, setResultsCollapsed] = useState(true);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [previewResult, setPreviewResult] = useState<MusicPreviewResult | null>(null);
  const [denoise, setDenoise] = useState(
    () => seedDenoise ?? localStorage.getItem(MUSIC_DENOISE_STORAGE_KEY) === "1"
  );
  const sessionPhase = useMusicSessionStore((state) => state.phase);
  const searchResponse = useMusicSessionStore((state) => state.response);
  const queuedIndices = useMusicSessionStore((state) => state.queuedIndices);
  const sessionError = useMusicSessionStore((state) => state.error);
  const startSearch = useMusicSessionStore((state) => state.startSearch);
  const cancelSearch = useMusicSessionStore((state) => state.cancelSearch);
  const releaseSession = useMusicSessionStore((state) => state.releaseSession);
  const markQueued = useMusicSessionStore((state) => state.markQueued);
  const draftRevisionRef = useRef(0);

  const retainWorkspace = useCallback(() => {
    onRetain?.();
  }, [onRetain]);

  const updateForm = useCallback(
    (patch: MusicFormPatch) => {
      draftRevisionRef.current += 1;
      retainWorkspace();
      setForm((current) => ({ ...current, ...patch }));
    },
    [retainWorkspace]
  );

  // 【Effect 白名单⑤】表单草稿持久化到 localStorage（keyword/playlistUrl 等瞬态字段除外）。
  // 留空的输出目录在提交层回退后端默认位置（createMusic*Request 均为 `|| null`），
  // 不再把默认值预先烘焙进草稿（原先用 Effect 异步解析默认目录后填进表单）
  useEffect(() => {
    const { keyword, playlistUrl, ...persisted } = form;
    saveStoredForm(MUSIC_FORM_STORAGE_KEY, persisted);
  }, [form]);

  // 【Effect 白名单⑤】降噪偏好持久化到 localStorage
  useEffect(() => {
    localStorage.setItem(MUSIC_DENOISE_STORAGE_KEY, denoise ? "1" : "0");
  }, [denoise]);

  const prepared = useMemo(() => prepareMusicConfiguration(form), [form]);
  const musicdlInstalled = dependency?.available ?? false;
  const pythonInstalled = pythonDependency?.available ?? false;

  // 【Effect 白名单⑤】配置预览：表单连续编辑期间对后端做防抖预览取数
  //（同 useDraftPreviewWorkspace 的防抖同步，版本守卫丢弃过期响应）
  useEffect(() => {
    const request = prepared.cli;
    if (!active || !musicdlInstalled || !pythonInstalled || !request) return;

    let canceled = false;
    const timeoutId = window.setTimeout(() => {
      void previewMusicCommand(request)
        .then((display) => {
          if (!canceled) setPreviewResult({ display, error: null });
        })
        .catch((error) => {
          if (!canceled) {
            setPreviewResult({
              display: null,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        });
    }, MUSIC_PREVIEW_DEBOUNCE_MS);

    return () => {
      canceled = true;
      window.clearTimeout(timeoutId);
    };
  }, [active, musicdlInstalled, prepared.cli, pythonInstalled]);

  const run = async () => {
    if (!prepared.cli || prepared.error) {
      setConfigurationError(prepared.error);
      return;
    }
    setConfigurationError(null);
    const submittedRevision = draftRevisionRef.current;
    retainWorkspace();

    if (form.mode === "playlist") {
      setTaskSubmitting(true);
      try {
        await musicdlPlaylist(createMusicPlaylistRequest(form, prepared.cli, denoise), form);
        notifications.show({ color: "green", message: t("music.playlistQueued") });
        if (
          draftRevisionRef.current === submittedRevision &&
          useMusicSessionStore.getState().phase === "idle"
        ) {
          onSubmitted?.();
        }
      } catch (error) {
        setConfigurationError(error instanceof Error ? error.message : String(error));
      } finally {
        setTaskSubmitting(false);
      }
      return;
    }

    try {
      setResultsCollapsed(false);
      await startSearch(createMusicSearchRequest(form, prepared.cli));
      setSelected([]);
    } catch {}
  };

  const downloadSelected = async () => {
    if (!searchResponse || !selected.length) return;
    const sessionId = searchResponse.sessionId;
    const indices = [...selected];
    const submittedSet = new Set(indices);
    retainWorkspace();
    setTaskSubmitting(true);
    setConfigurationError(null);
    try {
      await musicdlDownload(sessionId, indices, denoise, form);
      // markQueued 失败说明会话已漂移（防御路径）：保留勾选且不弹成功提示，避免误导
      if (markQueued(sessionId, indices)) {
        setSelected((current) => current.filter((value) => !submittedSet.has(value)));
        notifications.show({ color: "green", message: t("music.downloadQueued") });
      }
    } catch (error) {
      setConfigurationError(error instanceof Error ? error.message : String(error));
    } finally {
      setTaskSubmitting(false);
    }
  };

  const stopSearch = async () => {
    const submittedRevision = draftRevisionRef.current;
    try {
      await cancelSearch();
      if (draftRevisionRef.current === submittedRevision) onSubmitted?.();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    }
  };

  const endSearchSession = async () => {
    const submittedRevision = draftRevisionRef.current;
    try {
      await releaseSession();
      setSelected([]);
      if (draftRevisionRef.current === submittedRevision) onSubmitted?.();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    }
  };

  const pickOutputDirectory = async () => {
    const directory = await openDialog({ directory: true });
    if (typeof directory === "string") updateForm({ outputDirectory: directory });
  };

  const pickCookieFile = async () => {
    const file = await openDialog({ multiple: false, directory: false });
    if (typeof file === "string") updateForm({ cookiesFile: file });
  };

  const runDisabled =
    taskSubmitting ||
    (sessionPhase !== "idle" && sessionPhase !== "ready") ||
    form.sources.length === 0 ||
    !!prepared.error ||
    (form.mode === "search" ? !form.keyword.trim() : !form.playlistUrl.trim());
  // 禁用原因按优先级给出（submitting/会话切换是短暂过渡态，不给文案）
  const runDisabledReason = taskSubmitting
    ? null
    : form.sources.length === 0
      ? t("music.run.needSource")
      : prepared.error
        ? prepared.error
        : form.mode === "search" && !form.keyword.trim()
          ? t("music.run.needInput")
          : form.mode === "playlist" && !form.playlistUrl.trim()
            ? t("music.run.needInput")
            : null;
  const displayedError = configurationError || sessionError || prepared.error;
  const preview = previewResult?.display ?? null;
  const previewError = previewResult?.error ?? null;

  return (
    <div className="flex min-h-full flex-col gap-4 p-5">
      {active && (
          <MusicPageHeader
            mode={form.mode}
            runLoading={form.mode === "search" ? sessionPhase === "starting" : taskSubmitting}
            runDisabled={runDisabled}
            runDisabledReason={runDisabledReason}
            onRun={() => void run()}
          searching={sessionPhase === "searching" || sessionPhase === "canceling"}
          stopping={sessionPhase === "canceling"}
          onStopSearch={() => void stopSearch()}
          denoise={denoise}
          onDenoiseChange={setDenoise}
          dependencyLabels={dependencyLabels}
          onOpenDependencies={onOpenDependencies}
        />
      )}
      <L2TabNav
        items={[
          { page: "search", label: t("music.mode.search") },
          { page: "playlist", label: t("music.mode.playlist") }
        ]}
        value={form.mode}
        onChange={(mode) => updateForm({ mode })}
        aria-label={t("music.mode.aria")}
      />
      <SettingsSection>
        <MusicConfigurationPanel
          form={form}
          onChange={updateForm}
          onPickOutputDirectory={() => void pickOutputDirectory()}
          onPickCookieFile={() => void pickCookieFile()}
          globalProxy={globalProxy}
          defaultOutputDirectory={defaultOutputDirectory}
          cookieFiles={cookieFiles}
          onAddCookieFile={onAddCookieFile}
        />
      </SettingsSection>
      <MusicSourcePicker sources={form.sources} onChange={(sources) => updateForm({ sources })} />
      <SettingsSection
        icon={<IconAdjustmentsHorizontal size={20} stroke={1.8} />}
        title={t("music.advanced.title")}
        // 渲染期派生：配置出错时高级区强制展开——错误详情指向的字段藏在里面，
        // 不能让用户自己找路（原先用 Effect 观察 prepared.error 再 setState）
        opened={advancedOpen || prepared.error !== null}
        onToggle={() => setAdvancedOpen((value) => !value)}
      >
        <div className="flex flex-col gap-4">
          <Card padding="md">
            <MusicCommandPanel
              preview={preview}
              previewError={previewError}
              sessionPhase={sessionPhase}
              sourceCount={form.sources.length}
            />
          </Card>
          <MusicAdvancedSettings form={form} onChange={updateForm} />
        </div>
      </SettingsSection>
      {displayedError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5"
        >
          <IconAlertTriangle size={16} stroke={1.8} className="mt-0.5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-destructive">{t("music.errorTitle")}</p>
            <p className="mt-0.5 text-sm break-words text-foreground">{displayedError}</p>
          </div>
        </div>
      ) : null}

      <SettingsSection
        icon={<IconListDetails size={20} stroke={1.8} />}
        title={t("music.results.title")}
        action={
          searchResponse ? (
            <span className="text-xs text-muted-foreground">
              {t("music.results.count", { count: searchResponse.results.length })}
            </span>
          ) : null
        }
        opened={!resultsCollapsed}
        onToggle={() => setResultsCollapsed((value) => !value)}
      >
        {searchResponse ? (
          <MusicSearchResults
            key={searchResponse.sessionId}
            response={searchResponse}
            selected={selected}
            queuedIndices={queuedIndices}
            sessionPhase={sessionPhase}
            taskSubmitting={taskSubmitting}
            denoise={denoise}
            onSelectedChange={setSelected}
            onDownload={() => void downloadSelected()}
            onEndSession={() => void endSearchSession()}
          />
        ) : isSearchBusy(sessionPhase) ? (
          <div className="flex items-center justify-center gap-2 py-6">
            <IconLoader2 size={16} stroke={1.7} className="animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t("music.searchingHint")}</span>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("music.emptyResultsHint")}
          </p>
        )}
      </SettingsSection>
    </div>
  );
}
