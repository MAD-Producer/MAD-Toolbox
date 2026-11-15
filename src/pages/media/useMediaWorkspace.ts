import { notifications } from "../../lib/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaPageId } from "../../app/route";
import type { PreviewResult, TaskIntent, TaskSeed } from "../../contracts/types";
import { parseExpertArgv, useDraftPreviewWorkspace } from "../../hooks/useDraftPreviewWorkspace";
import {
  ffmpegEncoders,
  inspectMedia,
  mediaPreview,
  mediaPrSubmit,
  mediaScanInputs,
  mediaSubmit
} from "./api";
import { defaultMediaForm, type MediaFormState } from "./form";
import { loadStoredForm, saveStoredForm } from "../../lib/formStorage";
import { t } from "../../locale";
import {
  AUDIO_CODECS,
  CONTAINER_BY_OPERATION,
  MEDIA_PAGE_CONFIG,
  VIDEO_CODECS,
  containerForOperation,
  type MediaPageOperation
} from "./workflow";

export interface MediaWorkspacePageProps {
  active: boolean;
  seed?: TaskSeed | null;
  onRetain?: () => void;
  onSubmitted?: () => void;
  onNavigatePage?: (page: MediaPageId) => void;
}

interface UseMediaWorkspaceOptions extends MediaWorkspacePageProps {
  page: MediaPageId;
}

const MEDIA_FORM_STORAGE_KEY = "media.form";

export interface MediaWorkspaceModel {
  active: boolean;
  operations: readonly MediaPageOperation[];
  inputs: string[];
  operation: MediaPageOperation;
  form: MediaFormState;
  advancedOpen: boolean;
  expertText: string | null;
  preview: PreviewResult | null;
  previewError: string | null;
  submitting: boolean;
  inspection: string | null;
  firstInput: string;
  isPr: boolean;
  expertMode: boolean;
  containers: string[] | undefined;
  availableVideoCodecs: string[];
  availableAudioCodecs: string[];
  update: (patch: Partial<MediaFormState>) => void;
  switchPage: (page: MediaPageId) => void;
  setOperation: (operation: MediaPageOperation) => void;
  setExpertText: (value: string | null) => void;
  setInspection: (value: string | null) => void;
  toggleAdvanced: () => void;
  addFiles: () => Promise<void>;
  addPaths: (paths: string[]) => Promise<void>;
  removeInput: (path: string) => void;
  pickOutputDirectory: () => Promise<void>;
  inspectFirst: () => Promise<void>;
  enterExpert: () => void;
  submit: () => Promise<void>;
}

export function useMediaWorkspace({
  active,
  page,
  seed,
  onRetain,
  onSubmitted,
  onNavigatePage
}: UseMediaWorkspaceOptions): MediaWorkspaceModel {
  const pageConfig = MEDIA_PAGE_CONFIG[page];
  // 任务种子只在挂载时消费一次（deliver → generation+1 → 重挂）；rerun 保留输入文件，reuse 不保留
  const seedData =
    seed?.task.intent.type === "form" ? (seed.task.intent.data as Record<string, unknown>) : null;
  const [inputs, setInputsState] = useState<string[]>(() => {
    if (!seedData || seed?.purpose !== "rerun") return [];
    if (seedData.prCompatible === true) {
      return typeof seedData.input === "string" ? [seedData.input] : [];
    }
    const restored = { ...defaultMediaForm, ...(seedData as Partial<MediaFormState>) };
    return restored.input ? [restored.input] : [];
  });
  const [form, setForm] = useState<MediaFormState>(() => {
    const stored = loadStoredForm(MEDIA_FORM_STORAGE_KEY, defaultMediaForm);
    const storedOperation = pageConfig.operations.includes(stored.operation)
      ? stored.operation
      : pageConfig.operations[0];
    const base = { ...stored, container: containerForOperation(storedOperation, stored.container) };
    if (!seedData) return base;
    if (seedData.prCompatible === true) {
      return {
        ...base,
        outputDirectory:
          typeof seedData.outputDirectory === "string" ? seedData.outputDirectory : ""
      };
    }
    const restored = { ...defaultMediaForm, ...(seedData as Partial<MediaFormState>) };
    const restoredOperation = pageConfig.operations.includes(restored.operation)
      ? restored.operation
      : pageConfig.operations[0];
    return { ...restored, container: containerForOperation(restoredOperation, restored.container) };
  });
  const [operation, setOperationState] = useState<MediaPageOperation>(() => {
    if (seedData && seedData.prCompatible === true) return "pr-compatible";
    if (seedData) {
      const restored = { ...defaultMediaForm, ...(seedData as Partial<MediaFormState>) };
      if (pageConfig.operations.includes(restored.operation)) return restored.operation;
    }
    return pageConfig.operations.includes(form.operation) ? form.operation : pageConfig.operations[0];
  });
  const [encoders, setEncoders] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inspection, setInspection] = useState<string | null>(null);
  const inspectionRequestRef = useRef(0);

  const firstInput = inputs[0] ?? "";
  const isPr = operation === "pr-compatible";

  const buildPreviewIntent = useCallback(
    (): TaskIntent => ({ type: "form", data: { ...form, operation, input: firstInput } }),
    [form, operation, firstInput]
  );
  const draft = useDraftPreviewWorkspace({
    active,
    onRetain,
    initialExpertText:
      seed?.task.intent.type === "manual" ? seed.task.intent.data.argv.join("\n") : null,
    previewDisabled: isPr || !firstInput,
    clearPreviewWhenDisabled: !isPr && !firstInput,
    buildPreviewIntent,
    runPreview: mediaPreview
  });

  // 【Effect 白名单⑤】表单草稿持久化到 localStorage（同 bilibili/network 工作区，含 operation）
  useEffect(() => {
    const { input, ...persisted } = form;
    saveStoredForm(MEDIA_FORM_STORAGE_KEY, { ...persisted, operation });
  }, [form, operation]);

  const update = (patch: Partial<MediaFormState>) => {
    draft.reviseDraft();
    setForm((current) => ({ ...current, ...patch }));
  };

  // L2 页签切换：重置本页工作状态。由点击事件直接驱动（原先用 draftPage 影子 state
  // 在渲染期观察 page prop 变化后重置，属于被禁止的渲染期写入）
  const switchPage = (next: MediaPageId) => {
    if (next === page) return;
    const nextOperation = MEDIA_PAGE_CONFIG[next].operations[0];
    setInputsState([]);
    setOperationState(nextOperation);
    setForm((current) => ({
      ...defaultMediaForm,
      outputDirectory: current.outputDirectory,
      container: containerForOperation(nextOperation, defaultMediaForm.container)
    }));
    setAdvancedOpen(false);
    setInspection(null);
    draft.restoreExpertText(null);
    draft.resetPreview();
    onNavigatePage?.(next);
  };

  const setOperation = (nextOperation: MediaPageOperation) => {
    draft.reviseDraft();
    setOperationState(nextOperation);
    setForm((current) => ({
      ...current,
      container: containerForOperation(nextOperation, current.container)
    }));
  };

  // 【Effect 白名单⑤】进入本页时一次性拉取 FFmpeg 编码器清单（外部队列探测，结果缓存复用）
  useEffect(() => {
    if (!active || encoders.length > 0) return;
    let canceled = false;
    void ffmpegEncoders()
      .then((result) => {
        if (!canceled) setEncoders(result);
      })
      .catch(() => {});
    return () => {
      canceled = true;
    };
  }, [active, encoders.length]);

  const addFiles = async () => {
    const selected = await openDialog({ multiple: true });
    const picked = Array.isArray(selected) ? selected : selected ? [selected] : [];
    if (picked.length) {
      draft.reviseDraft();
      setInputsState((current) => [...new Set([...current, ...picked])]);
    }
  };

  const addPaths = async (paths: string[]) => {
    if (paths.length === 0) return;
    const includeSubtitles = isPr || operation === "subtitle-extract";
    try {
      const files = await mediaScanInputs(paths, includeSubtitles);
      if (files.length === 0) {
        notifications.show({ message: t("media.noMediaFilesFound"), color: "yellow" });
        return;
      }
      draft.reviseDraft();
      setInputsState((current) => [...new Set([...current, ...files])]);
    } catch (error) {
      notifications.show({ message: String(error), color: "red" });
    }
  };

  const removeInput = useCallback(
    (path: string) => {
      draft.reviseDraft();
      setInputsState((current) => current.filter((input) => input !== path));
    },
    [draft.reviseDraft]
  );

  const pickOutputDirectory = async () => {
    const directory = await openDialog({ directory: true });
    if (typeof directory === "string") update({ outputDirectory: directory });
  };

  const inspectFirst = async () => {
    if (!firstInput) return;
    const requestedRevision = draft.draftRevisionRef.current;
    const requestId = inspectionRequestRef.current + 1;
    inspectionRequestRef.current = requestId;
    try {
      const result = await inspectMedia(firstInput);
      if (
        inspectionRequestRef.current === requestId &&
        draft.draftRevisionRef.current === requestedRevision
      ) {
        setInspection(result.summary);
      }
    } catch (error) {
      if (
        inspectionRequestRef.current === requestId &&
        draft.draftRevisionRef.current === requestedRevision
      ) {
        notifications.show({ color: "red", message: String(error) });
      }
    }
  };

  const submit = async () => {
    const submittedRevision = draft.draftRevisionRef.current;
    onRetain?.();
    setSubmitting(true);
    try {
      if (draft.expertText !== null) {
        await mediaSubmit([], {
          type: "manual",
          data: { argv: parseExpertArgv(draft.expertText) }
        });
      } else if (isPr) {
        await mediaPrSubmit(inputs, form.outputDirectory.trim() || null);
      } else {
        await mediaSubmit(inputs, {
          type: "form",
          data: { ...form, operation, input: "" }
        });
      }
      notifications.show({ color: "green", message: t("media.taskQueued") });
      if (draft.draftRevisionRef.current === submittedRevision) onSubmitted?.();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const expertMode = draft.expertText !== null;
  const containers = CONTAINER_BY_OPERATION[operation];
  const availableVideoCodecs = VIDEO_CODECS.filter(
    (codec) => codec === "copy" || encoders.length === 0 || encoders.includes(codec)
  );
  const availableAudioCodecs = AUDIO_CODECS.filter(
    (codec) => codec === "copy" || encoders.length === 0 || encoders.includes(codec)
  );

  return {
    active,
    operations: pageConfig.operations,
    inputs,
    operation,
    form,
    // 渲染期派生：预览失败时命令面板在折叠的高级区内，强制展开避免错误成为断头路
    //（原先用 Effect 观察 previewError 再 setState，错误存在期间展开状态由派生保证）
    advancedOpen: advancedOpen || draft.previewError !== null,
    expertText: draft.expertText,
    preview: draft.preview,
    previewError: draft.previewError,
    submitting,
    inspection,
    firstInput,
    isPr,
    expertMode,
    containers,
    availableVideoCodecs,
    availableAudioCodecs,
    update,
    switchPage,
    setOperation,
    setExpertText: draft.setExpertText,
    setInspection,
    toggleAdvanced: () => setAdvancedOpen((value) => !value),
    addFiles,
    addPaths,
    removeInput,
    pickOutputDirectory,
    inspectFirst,
    enterExpert: draft.enterExpert,
    submit
  };
}
