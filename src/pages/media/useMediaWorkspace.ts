import { notifications } from "../../lib/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import type { MediaPageId } from "../../app/route";
import type { TaskIntent, TaskSeed } from "../../contracts/types";
import {
  ffmpegEncoders,
  inspectMedia,
  mediaPreview,
  mediaPrSubmit,
  mediaScanInputs,
  mediaSubmit,
  type PreviewResult
} from "./api";
import { defaultMediaForm, type MediaFormState } from "./form";
import { resolveDefaultOutputDirectory } from "../../lib/platform";
import {
  AUDIO_CODECS,
  CONTAINER_BY_OPERATION,
  MEDIA_PAGE_CONFIG,
  VIDEO_CODECS,
  type MediaPageOperation
} from "./workflow";

export interface MediaWorkspacePageProps {
  active: boolean;
  seed?: TaskSeed | null;
  onSeedConsumed?: () => void;
  onRetain?: () => void;
  onSubmitted?: () => void;
  onNavigatePage?: (page: MediaPageId) => void;
}

interface UseMediaWorkspaceOptions extends MediaWorkspacePageProps {
  page: MediaPageId;
}

interface RevisionedPreview {
  revision: number;
  result: PreviewResult | null;
  error: string | null;
}

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
  onSeedConsumed,
  onRetain,
  onSubmitted
}: UseMediaWorkspaceOptions): MediaWorkspaceModel {
  const pageConfig = MEDIA_PAGE_CONFIG[page];
  const [inputs, setInputsState] = useState<string[]>([]);
  const [operation, setOperationState] = useState<MediaPageOperation>(
    () => pageConfig.operations[0]
  );
  const [form, setForm] = useState<MediaFormState>(defaultMediaForm);
  const [encoders, setEncoders] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expertText, setExpertTextState] = useState<string | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [previewState, setPreviewState] = useState<RevisionedPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inspection, setInspection] = useState<string | null>(null);
  const draftRevisionRef = useRef(0);
  const previewStateRef = useRef<RevisionedPreview | null>(null);
  const inspectionRequestRef = useRef(0);
  previewStateRef.current = previewState;

  // 切换工作流即更换草稿：page 变化时在渲染期重置全部表单状态（无中间脏帧）
  const [draftPage, setDraftPage] = useState(page);
  if (draftPage !== page) {
    setDraftPage(page);
    setInputsState([]);
    setOperationState(pageConfig.operations[0]);
    // 输出目录是跨工作流共享的默认值，切换草稿时保留
    setForm({ ...defaultMediaForm, outputDirectory: form.outputDirectory });
    setAdvancedOpen(false);
    setExpertTextState(null);
    setPreviewState(null);
    setInspection(null);
  }

  const reviseDraft = () => {
    const nextRevision = draftRevisionRef.current + 1;
    draftRevisionRef.current = nextRevision;
    setDraftRevision(nextRevision);
    onRetain?.();
  };

  // 输出目录默认统一到 系统「下载」/MADToolbox；程序预填不算用户编辑，不推进草稿版本
  useEffect(() => {
    let canceled = false;
    void resolveDefaultOutputDirectory().then((directory) => {
      if (canceled || !directory) return;
      setForm((current) =>
        current.outputDirectory ? current : { ...current, outputDirectory: directory }
      );
    });
    return () => {
      canceled = true;
    };
  }, []);

  const update = (patch: Partial<MediaFormState>) => {
    reviseDraft();
    setForm((current) => ({ ...current, ...patch }));
  };

  const setOperation = (nextOperation: MediaPageOperation) => {
    reviseDraft();
    setOperationState(nextOperation);
  };

  const setExpertText = (value: string | null) => {
    reviseDraft();
    setExpertTextState(value);
  };

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

  useEffect(() => {
    if (!seed) return;
    setPreviewState(null);
    const keepInputs = seed.purpose === "rerun";
    if (seed.task.intent.type === "form") {
      const data = seed.task.intent.data as Record<string, unknown>;
      if (data.prCompatible === true) {
        setOperationState("pr-compatible");
        setInputsState(keepInputs && typeof data.input === "string" ? [data.input] : []);
        setForm((current) => ({
          ...current,
          outputDirectory: typeof data.outputDirectory === "string" ? data.outputDirectory : ""
        }));
      } else {
        const restored = { ...defaultMediaForm, ...(data as Partial<MediaFormState>) };
        setOperationState(restored.operation);
        setForm(restored);
        setInputsState(keepInputs && restored.input ? [restored.input] : []);
      }
      setExpertTextState(null);
    } else {
      setExpertTextState(seed.task.intent.data.argv.join("\n"));
    }
    onSeedConsumed?.();
  }, [seed, onSeedConsumed]);

  const firstInput = inputs[0] ?? "";
  const isPr = operation === "pr-compatible";

  useEffect(() => {
    if (!active || expertText !== null || isPr) return;
    if (!firstInput) {
      setPreviewState({ revision: draftRevision, result: null, error: null });
      return;
    }
    let canceled = false;
    const revision = draftRevision;
    const handle = window.setTimeout(() => {
      const intent: TaskIntent = {
        type: "form",
        data: { ...form, operation, input: firstInput }
      };
      mediaPreview(intent)
        .then((result) => {
          if (canceled) return;
          setPreviewState({ revision, result, error: null });
        })
        .catch((error) => {
          if (canceled) return;
          setPreviewState({ revision, result: null, error: String(error) });
        });
    }, 150);
    return () => {
      canceled = true;
      window.clearTimeout(handle);
    };
  }, [active, draftRevision, form, operation, firstInput, expertText, isPr]);

  const addFiles = async () => {
    const selected = await openDialog({ multiple: true });
    const picked = Array.isArray(selected) ? selected : selected ? [selected] : [];
    if (picked.length) {
      reviseDraft();
      setInputsState((current) => [...new Set([...current, ...picked])]);
    }
  };

  const addPaths = async (paths: string[]) => {
    if (paths.length === 0) return;
    // PR 与字幕抽取按提交语义包含字幕文件，其余场景过滤
    const includeSubtitles = isPr || operation === "subtitle-extract";
    try {
      const files = await mediaScanInputs(paths, includeSubtitles);
      if (files.length === 0) {
        notifications.show({ message: "没有找到可处理的媒体文件", color: "yellow" });
        return;
      }
      reviseDraft();
      setInputsState((current) => [...new Set([...current, ...files])]);
    } catch (error) {
      notifications.show({ message: String(error), color: "red" });
    }
  };

  const removeInput = (path: string) => {
    reviseDraft();
    setInputsState((current) => current.filter((input) => input !== path));
  };

  const pickOutputDirectory = async () => {
    const directory = await openDialog({ directory: true });
    if (typeof directory === "string") update({ outputDirectory: directory });
  };

  const inspectFirst = async () => {
    if (!firstInput) return;
    const requestedRevision = draftRevisionRef.current;
    const requestId = inspectionRequestRef.current + 1;
    inspectionRequestRef.current = requestId;
    try {
      const result = await inspectMedia(firstInput);
      if (
        inspectionRequestRef.current === requestId &&
        draftRevisionRef.current === requestedRevision
      ) {
        setInspection(result.summary);
      }
    } catch (error) {
      if (
        inspectionRequestRef.current === requestId &&
        draftRevisionRef.current === requestedRevision
      ) {
        notifications.show({ color: "red", message: String(error) });
      }
    }
  };

  const enterExpert = () => {
    const currentPreview = previewStateRef.current;
    if (currentPreview?.revision === draftRevisionRef.current && currentPreview.result !== null) {
      setExpertText(currentPreview.result.argv.join("\n"));
    }
  };

  const submit = async () => {
    const submittedRevision = draftRevisionRef.current;
    onRetain?.();
    setSubmitting(true);
    try {
      if (expertText !== null) {
        const argv = expertText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        await mediaSubmit([], { type: "manual", data: { argv } });
      } else if (isPr) {
        await mediaPrSubmit(inputs, form.outputDirectory.trim() || null);
      } else {
        await mediaSubmit(inputs, {
          type: "form",
          data: { ...form, operation, input: "" }
        });
      }
      notifications.show({ color: "green", message: "任务已加入队列" });
      if (draftRevisionRef.current === submittedRevision) onSubmitted?.();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const expertMode = expertText !== null;
  const containers = CONTAINER_BY_OPERATION[operation];
  const availableVideoCodecs = VIDEO_CODECS.filter(
    (codec) => codec === "copy" || encoders.length === 0 || encoders.includes(codec)
  );
  const availableAudioCodecs = AUDIO_CODECS.filter(
    (codec) => codec === "copy" || encoders.length === 0 || encoders.includes(codec)
  );
  // 草稿变更后沿用上一次预览直到新结果整体替换，避免「…」与命令交替导致高度抖动
  const preview = previewState?.result ?? null;
  const previewError = previewState?.error ?? null;

  return {
    active,
    operations: pageConfig.operations,
    inputs,
    operation,
    form,
    advancedOpen,
    expertText,
    preview,
    previewError,
    submitting,
    inspection,
    firstInput,
    isPr,
    expertMode,
    containers,
    availableVideoCodecs,
    availableAudioCodecs,
    update,
    setOperation,
    setExpertText,
    setInspection,
    toggleAdvanced: () => setAdvancedOpen((value) => !value),
    addFiles,
    addPaths,
    removeInput,
    pickOutputDirectory,
    inspectFirst,
    enterExpert,
    submit
  };
}
