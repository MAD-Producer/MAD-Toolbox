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
  onSeedConsumed?: () => void;
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
  const [form, setForm] = useState<MediaFormState>(() => {
    const stored = loadStoredForm(MEDIA_FORM_STORAGE_KEY, defaultMediaForm);
    const initialOperation = pageConfig.operations.includes(stored.operation)
      ? stored.operation
      : pageConfig.operations[0];
    return { ...stored, container: containerForOperation(initialOperation, stored.container) };
  });
  const [operation, setOperationState] = useState<MediaPageOperation>(() =>
    pageConfig.operations.includes(form.operation) ? form.operation : pageConfig.operations[0]
  );
  const [encoders, setEncoders] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inspection, setInspection] = useState<string | null>(null);
  const inspectionRequestRef = useRef(0);

  const [draftPage, setDraftPage] = useState(page);
  if (draftPage !== page) {
    const nextOperation = pageConfig.operations[0];
    setDraftPage(page);
    setInputsState([]);
    setOperationState(nextOperation);
    setForm((current) => ({
      ...defaultMediaForm,
      outputDirectory: current.outputDirectory,
      container: containerForOperation(nextOperation, defaultMediaForm.container)
    }));
    setAdvancedOpen(false);
    setInspection(null);
  }

  const firstInput = inputs[0] ?? "";
  const isPr = operation === "pr-compatible";

  const buildPreviewIntent = useCallback(
    (): TaskIntent => ({ type: "form", data: { ...form, operation, input: firstInput } }),
    [form, operation, firstInput]
  );
  const draft = useDraftPreviewWorkspace({
    active,
    onRetain,
    previewDisabled: isPr || !firstInput,
    clearPreviewWhenDisabled: !isPr && !firstInput,
    buildPreviewIntent,
    runPreview: mediaPreview,
    onDefaultOutputDirectory: (directory) =>
      setForm((current) =>
        current.outputDirectory ? current : { ...current, outputDirectory: directory }
      )
  });

  if (draftPage !== page) {
    draft.restoreExpertText(null);
    draft.resetPreview();
  }

  useEffect(() => {
    const { input, ...persisted } = form;
    saveStoredForm(MEDIA_FORM_STORAGE_KEY, { ...persisted, operation });
  }, [form, operation]);

  const update = (patch: Partial<MediaFormState>) => {
    draft.reviseDraft();
    setForm((current) => ({ ...current, ...patch }));
  };

  const setOperation = (nextOperation: MediaPageOperation) => {
    draft.reviseDraft();
    setOperationState(nextOperation);
    setForm((current) => ({
      ...current,
      container: containerForOperation(nextOperation, current.container)
    }));
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
    draft.resetPreview();
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
        setForm({
          ...restored,
          container: containerForOperation(restored.operation, restored.container)
        });
        setInputsState(keepInputs && restored.input ? [restored.input] : []);
      }
      draft.restoreExpertText(null);
    } else {
      draft.restoreExpertText(seed.task.intent.data.argv.join("\n"));
    }
    onSeedConsumed?.();
  }, [seed, onSeedConsumed]);

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
    advancedOpen,
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
