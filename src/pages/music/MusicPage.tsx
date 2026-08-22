/**
 * Music 页面只编排表单、搜索会话与任务提交；具体界面由 Music 前缀组件负责。
 * 搜索结果由应用级 music session store 常驻保存，页面隐藏不会中断后端事件监听。
 */

import { Alert, Group, Loader, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "../../lib/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CollapsibleSection } from "../../components/common/CollapsibleSection";
import { MusicAdvancedSettings } from "./MusicAdvancedSettings";
import { MusicCommandPanel } from "./MusicCommandPanel";
import { MusicConfigurationPanel } from "./MusicConfigurationPanel";
import { MusicPageHeader } from "./MusicPageHeader";
import { MusicSearchResults } from "./MusicSearchResults";
import { MusicSourcePicker } from "./MusicSourcePicker";
import type { DependencyStatus } from "../../contracts/dependency";
import { resolveDefaultOutputDirectory } from "../../lib/platform";
import { useMusicSessionStore } from "../../stores/music-session";
import { previewMusicCommand, type MusicdlPlaylistRequest, type SubmitResult } from "./api";
import {
  applyMusicTemplate,
  createInitialMusicForm,
  createMusicPlaylistRequest,
  createMusicSearchRequest,
  createMusicTemplateSource,
  MUSIC_SOURCE_GROUPS,
  prepareMusicConfiguration,
  type MusicdlCliOptions,
  type MusicFormPatch,
  type MusicFormState
} from "./configuration";
import { loadTemplates, saveTemplate, type SavedTemplate } from "./templates";

const MUSIC_PREVIEW_DEBOUNCE_MS = 180;
const MUSIC_SOURCES_STORAGE_KEY = "music.selectedSources";
const MUSIC_DENOISE_STORAGE_KEY = "music.autoDenoise";

const KNOWN_MUSIC_SOURCE_IDS = new Set(
  MUSIC_SOURCE_GROUPS.flatMap(([, sources]) => sources.map(([id]) => id))
);

function createPersistedMusicForm(): MusicFormState {
  const form = createInitialMusicForm();
  try {
    const saved = JSON.parse(localStorage.getItem(MUSIC_SOURCES_STORAGE_KEY) ?? "null") as unknown;
    if (Array.isArray(saved)) {
      const sources = saved.filter(
        (id): id is string => typeof id === "string" && KNOWN_MUSIC_SOURCE_IDS.has(id)
      );
      return { ...form, sources };
    }
  } catch {
    // 本地数据损坏时回落到默认源
  }
  return form;
}

interface MusicPreviewResult {
  request: MusicdlCliOptions;
  display: string | null;
  error: string | null;
}

interface MusicPageProps {
  active: boolean;
  dependency: DependencyStatus | null;
  pythonDependency: DependencyStatus | null;
  defaultOutputDirectory: string | null;
  /** 设置页的全局代理；已设置时作为占位提示，留空提交即使用它 */
  globalProxy: string | null;
  onPlaylist: (request: MusicdlPlaylistRequest) => Promise<SubmitResult>;
  onDownload: (
    sessionId: string,
    indices: number[],
    downsample: boolean
  ) => Promise<SubmitResult>;
  onRetain?: () => void;
  onSubmitted?: () => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

export function MusicPage({
  active,
  dependency,
  pythonDependency,
  defaultOutputDirectory,
  globalProxy,
  onPlaylist,
  onDownload,
  onRetain,
  onSubmitted,
  dependencyLabels,
  onOpenDependencies
}: MusicPageProps) {
  const [form, setForm] = useState(createPersistedMusicForm);
  const [advancedOpen, advancedToggle] = useDisclosure(false);
  const [resultsOpen, resultsHandlers] = useDisclosure(false);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [templateMenuOpened, setTemplateMenuOpened] = useState(false);
  const [templates, setTemplates] = useState<SavedTemplate[]>(() => loadTemplates(localStorage));
  const [previewResult, setPreviewResult] = useState<MusicPreviewResult | null>(null);
  const [denoise, setDenoise] = useState(
    () => localStorage.getItem(MUSIC_DENOISE_STORAGE_KEY) === "1"
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

  useEffect(() => {
    const fillDefault = (directory: string) =>
      setForm((current) =>
        current.outputDirectory ? current : { ...current, outputDirectory: directory }
      );
    if (defaultOutputDirectory) {
      fillDefault(defaultOutputDirectory);
      return;
    }
    // 设置未指定时统一回落到 系统「下载」/MADToolbox
    let canceled = false;
    void resolveDefaultOutputDirectory().then((directory) => {
      if (!canceled && directory) fillDefault(directory);
    });
    return () => {
      canceled = true;
    };
  }, [defaultOutputDirectory]);

  // 音乐源选择随改动落盘，下次启动沿用
  useEffect(() => {
    localStorage.setItem(MUSIC_SOURCES_STORAGE_KEY, JSON.stringify(form.sources));
  }, [form.sources]);

  useEffect(() => {
    localStorage.setItem(MUSIC_DENOISE_STORAGE_KEY, denoise ? "1" : "0");
  }, [denoise]);

  // 搜索结果到达时自动展开结果卡片
  useEffect(() => {
    if (searchResponse) resultsHandlers.open();
  }, [searchResponse, resultsHandlers.open]);

  useEffect(() => {
    if (!active) setTemplateMenuOpened(false);
  }, [active]);

  const prepared = useMemo(() => prepareMusicConfiguration(form), [form]);
  const musicdlInstalled = dependency?.available ?? false;
  const pythonInstalled = pythonDependency?.available ?? false;

  useEffect(() => {
    const request = prepared.cli;
    if (!active || !musicdlInstalled || !pythonInstalled || !request) return;

    let canceled = false;
    const timeoutId = window.setTimeout(() => {
      void previewMusicCommand(request)
        .then((display) => {
          if (!canceled) setPreviewResult({ request, display, error: null });
        })
        .catch((error) => {
          if (!canceled) {
            setPreviewResult({
              request,
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

  const saveCurrentTemplate = (name: string) => {
    setTemplates(saveTemplate(localStorage, name, createMusicTemplateSource(form)));
    notifications.show({ message: `模板「${name}」已保存（不含登录凭证）` });
  };

  const useTemplate = (template: SavedTemplate) => {
    draftRevisionRef.current += 1;
    retainWorkspace();
    setForm((current) => applyMusicTemplate(current, template));
    setConfigurationError(null);
    notifications.show({ message: `已应用模板「${template.name}」（登录凭证类字段不入模板）` });
  };

  const run = async () => {
    setConfigurationError(prepared.error);
    if (!prepared.cli || prepared.error) return;
    const submittedRevision = draftRevisionRef.current;
    retainWorkspace();

    if (form.mode === "playlist") {
      setTaskSubmitting(true);
      setConfigurationError(null);
      try {
        await onPlaylist(createMusicPlaylistRequest(form, prepared.cli, denoise));
        notifications.show({ color: "green", message: "歌单下载任务已加入队列" });
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

    setConfigurationError(null);
    try {
      await startSearch(createMusicSearchRequest(form, prepared.cli));
      setSelected([]);
    } catch {
      // Store 保留旧 ready 会话并承载错误文本。
    }
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
      await onDownload(sessionId, indices, denoise);
      if (markQueued(sessionId, indices)) {
        setSelected((current) => current.filter((value) => !submittedSet.has(value)));
      }
      notifications.show({ color: "green", message: "所选音乐已加入任务队列" });
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

  const runDisabled =
    taskSubmitting ||
    (sessionPhase !== "idle" && sessionPhase !== "ready") ||
    form.sources.length === 0 ||
    !!prepared.error ||
    (form.mode === "search" ? !form.keyword.trim() : !form.playlistUrl.trim());
  const displayedError = configurationError || sessionError || prepared.error;
  const previewMatchesCurrentRequest =
    prepared.cli !== null && previewResult?.request === prepared.cli;
  const preview = previewMatchesCurrentRequest ? previewResult.display : null;
  const previewError = previewMatchesCurrentRequest ? previewResult.error : null;

  return (
    <Stack gap="md" p="md">
      <MusicPageHeader
        active={active}
        mode={form.mode}
        runLoading={form.mode === "search" ? sessionPhase === "starting" : taskSubmitting}
        runDisabled={runDisabled}
        onRun={() => void run()}
        searching={sessionPhase === "searching" || sessionPhase === "canceling"}
        stopping={sessionPhase === "canceling"}
        onStopSearch={() => void stopSearch()}
        denoise={denoise}
        onDenoiseChange={setDenoise}
        templateMenuOpened={templateMenuOpened}
        templates={templates}
        onTemplateMenuChange={setTemplateMenuOpened}
        onSaveTemplate={saveCurrentTemplate}
        onApplyTemplate={useTemplate}
        dependencyLabels={dependencyLabels}
        onOpenDependencies={onOpenDependencies}
      />
      <MusicConfigurationPanel
        form={form}
        onChange={updateForm}
        onPickOutputDirectory={() => void pickOutputDirectory()}
        globalProxy={globalProxy}
      />
      <MusicSourcePicker sources={form.sources} onChange={(sources) => updateForm({ sources })} />
      <CollapsibleSection
        title={
          <Text size="sm" fw={500}>
            高级参数
          </Text>
        }
        opened={advancedOpen}
        onToggle={advancedToggle.toggle}
      >
        <Stack gap="sm">
          <MusicCommandPanel
            preview={preview}
            previewError={previewError}
            sessionPhase={sessionPhase}
            sourceCount={form.sources.length}
            withDivider
          />
          <MusicAdvancedSettings form={form} onChange={updateForm} />
        </Stack>
      </CollapsibleSection>
      {displayedError ? (
        <Alert color="red" icon={<IconAlertTriangle size={16} />} title="参数或执行错误">
          {displayedError}
        </Alert>
      ) : null}
      {/* 结果卡片常驻：未搜索时引导，搜索中显示加载，就绪后展示结果 */}
      <CollapsibleSection
        title={
          <Text size="sm" fw={500}>
            搜索结果
            {searchResponse && (
              <Text span size="xs" c="dimmed" ml={8}>
                {searchResponse.results.length} 项
              </Text>
            )}
          </Text>
        }
        opened={resultsOpen}
        onToggle={resultsHandlers.toggle}
      >
        {searchResponse ? (
          <MusicSearchResults
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
        ) : sessionPhase === "starting" ||
          sessionPhase === "searching" ||
          sessionPhase === "canceling" ? (
          <Group gap="sm" justify="center" py="lg">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              正在搜索，请稍候…
            </Text>
          </Group>
        ) : (
          <Text size="sm" c="dimmed" ta="center" py="lg">
            还没有搜索结果——在上方选择音乐源、输入关键词并点击「开始搜索」后，结果会展示在这里。
          </Text>
        )}
      </CollapsibleSection>
    </Stack>
  );
}
