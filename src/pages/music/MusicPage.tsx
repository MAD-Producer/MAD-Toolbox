import { Alert, Box, Card, Group, Loader, Stack, Text } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconListDetails } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "../../lib/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SettingsSection } from "../../components/common/SettingsSection";
import { L2TabNav } from "../../components/common/L2TabNav";
import { t } from "../../locale";
import { MusicAdvancedSettings } from "./MusicAdvancedSettings";
import { MusicCommandPanel } from "./MusicCommandPanel";
import { MusicConfigurationPanel } from "./MusicConfigurationPanel";
import { MusicPageHeader } from "./MusicPageHeader";
import { MusicSearchResults } from "./MusicSearchResults";
import { MusicSourcePicker } from "./MusicSourcePicker";
import type { DependencyStatus } from "../../contracts/dependency";
import type { TaskSeed } from "../../contracts/types";
import { loadStoredForm, saveStoredForm } from "../../lib/formStorage";
import { resolveDefaultOutputDirectory } from "../../lib/platform";
import { useMusicSessionStore } from "../../stores/music-session";
import { previewMusicCommand, type MusicdlPlaylistRequest, type SubmitResult } from "./api";
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
  onSeedConsumed?: () => void;
  dependency: DependencyStatus | null;
  pythonDependency: DependencyStatus | null;
  defaultOutputDirectory: string | null;
  globalProxy: string | null;
  onPlaylist: (request: MusicdlPlaylistRequest, form: MusicFormState) => Promise<SubmitResult>;
  onDownload: (
    sessionId: string,
    indices: number[],
    downsample: boolean,
    form: MusicFormState
  ) => Promise<SubmitResult>;
  onRetain?: () => void;
  onSubmitted?: () => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

export function MusicPage({
  active,
  seed,
  onSeedConsumed,
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
    let canceled = false;
    void resolveDefaultOutputDirectory().then((directory) => {
      if (!canceled && directory) fillDefault(directory);
    });
    return () => {
      canceled = true;
    };
  }, [defaultOutputDirectory]);

  useEffect(() => {
    const { keyword, playlistUrl, ...persisted } = form;
    saveStoredForm(MUSIC_FORM_STORAGE_KEY, persisted);
  }, [form]);

  useEffect(() => {
    localStorage.setItem(MUSIC_DENOISE_STORAGE_KEY, denoise ? "1" : "0");
  }, [denoise]);

  useEffect(() => {
    if (searchResponse) resultsHandlers.open();
  }, [searchResponse, resultsHandlers.open]);

  useEffect(() => {
    if (!seed) return;
    setPreviewResult(null);
    const data = seed.task.intent.type === "form" ? seed.task.intent.data : {};
    const snapshot = (data.form ?? {}) as Partial<MusicFormState>;
    const mode: MusicFormState["mode"] =
      snapshot.mode ?? (data.musicdl === "playlist" ? "playlist" : "search");
    setForm({ ...createInitialMusicForm(), ...snapshot, mode, keyword: "", playlistUrl: "" });
    if (typeof data.denoise === "boolean") setDenoise(data.denoise);
    onSeedConsumed?.();
  }, [seed, onSeedConsumed]);

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
    setConfigurationError(prepared.error);
    if (!prepared.cli || prepared.error) return;
    const submittedRevision = draftRevisionRef.current;
    retainWorkspace();

    if (form.mode === "playlist") {
      setTaskSubmitting(true);
      setConfigurationError(null);
      try {
        await onPlaylist(createMusicPlaylistRequest(form, prepared.cli, denoise), form);
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

    setConfigurationError(null);
    try {
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
      await onDownload(sessionId, indices, denoise, form);
      if (markQueued(sessionId, indices)) {
        setSelected((current) => current.filter((value) => !submittedSet.has(value)));
      }
      notifications.show({ color: "green", message: t("music.downloadQueued") });
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
  const displayedError = configurationError || sessionError || prepared.error;
  const preview = previewResult?.display ?? null;
  const previewError = previewResult?.error ?? null;

  return (
    <Box mih="100%">
      <Stack gap="md" p="lg">
        {active && (
          <MusicPageHeader
            mode={form.mode}
            runLoading={form.mode === "search" ? sessionPhase === "starting" : taskSubmitting}
            runDisabled={runDisabled}
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
          />
        </SettingsSection>
        <MusicSourcePicker sources={form.sources} onChange={(sources) => updateForm({ sources })} />
        <SettingsSection
          icon={<IconAdjustmentsHorizontal size={20} stroke={1.8} />}
          title={t("music.advanced.title")}
          opened={advancedOpen}
          onToggle={advancedToggle.toggle}
        >
          <Stack gap="md">
            <Card withBorder padding="md" radius="md">
              <MusicCommandPanel
                preview={preview}
                previewError={previewError}
                sessionPhase={sessionPhase}
                sourceCount={form.sources.length}
              />
            </Card>
            <MusicAdvancedSettings form={form} onChange={updateForm} />
          </Stack>
        </SettingsSection>
        {displayedError ? (
          <Alert color="red" icon={<IconAlertTriangle size={16} />} title={t("music.errorTitle")}>
            {displayedError}
          </Alert>
        ) : null}

        <SettingsSection
          icon={<IconListDetails size={20} stroke={1.8} />}
          title={t("music.results.title")}
          action={
            searchResponse ? (
              <Text size="xs" c="dimmed">
                {t("music.results.count", { count: searchResponse.results.length })}
              </Text>
            ) : null
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
                {t("music.searchingHint")}
              </Text>
            </Group>
          ) : (
            <Text size="sm" c="dimmed" ta="center" py="lg">
              {t("music.emptyResultsHint")}
            </Text>
          )}
        </SettingsSection>
      </Stack>
    </Box>
  );
}
