import { useDisclosure } from "@mantine/hooks";
import { notifications } from "../../lib/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import type { TaskIntent, TaskSeed } from "../../contracts/types";
import { t } from "../../locale";
import { parseExpertArgv, useDraftPreviewWorkspace } from "../../hooks/useDraftPreviewWorkspace";
import { bilibiliPreview, bilibiliSubmit } from "./api";
import { defaultBilibiliForm, type BilibiliFormState } from "./form";
import { loadStoredForm, saveStoredForm } from "../../lib/formStorage";
import { useBilibiliLoginStore } from "../../stores/bilibili-login";

const BILIBILI_FORM_STORAGE_KEY = "bilibili.form";

export interface BilibiliPageProps {
  active: boolean;
  seed?: TaskSeed | null;
  onSeedConsumed?: () => void;
  onRetain?: () => void;
  onSubmitted?: () => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

export function useBilibiliWorkspace({
  active,
  seed,
  onSeedConsumed,
  onRetain,
  onSubmitted
}: BilibiliPageProps) {
  const [form, setForm] = useState<BilibiliFormState>(() =>
    loadStoredForm(BILIBILI_FORM_STORAGE_KEY, defaultBilibiliForm)
  );
  const [advancedOpen, advanced] = useDisclosure(false);
  const [submitting, setSubmitting] = useState(false);
  const loginQr = useBilibiliLoginStore((state) => state.qrDataUrl);
  const loginPhase = useBilibiliLoginStore((state) => state.phase);
  const loginLoggedIn = useBilibiliLoginStore((state) => state.loggedIn);
  const startLogin = useBilibiliLoginStore((state) => state.start);
  const refreshLoginStatus = useBilibiliLoginStore((state) => state.refresh);
  const logout = useBilibiliLoginStore((state) => state.logout);
  const dismissLoginQr = useBilibiliLoginStore((state) => state.dismissQr);

  const buildPreviewIntent = useCallback(
    (): TaskIntent => ({ type: "form", data: { ...form } }),
    [form]
  );
  const draft = useDraftPreviewWorkspace({
    active,
    onRetain,
    buildPreviewIntent,
    runPreview: bilibiliPreview,
    onDefaultOutputDirectory: (directory) =>
      setForm((current) =>
        current.outputDirectory ? current : { ...current, outputDirectory: directory }
      )
  });

  const update = (patch: Partial<BilibiliFormState>) => {
    draft.reviseDraft();
    setForm((current) => ({ ...current, ...patch }));
  };

  useEffect(() => {
    const { url, ...persisted } = form;
    saveStoredForm(BILIBILI_FORM_STORAGE_KEY, persisted);
  }, [form]);

  useEffect(() => {
    if (!seed) return;
    draft.resetPreview();
    if (seed.task.intent.type === "form") {
      draft.restoreExpertText(null);
      const restored = {
        ...defaultBilibiliForm,
        ...(seed.task.intent.data as Partial<BilibiliFormState>)
      };
      if (seed.purpose === "reuse") restored.url = "";
      setForm(restored);
    } else {
      draft.restoreExpertText(seed.task.intent.data.argv.join("\n"));
      if (seed.task.intent.data.argv.some((argument) => argument === "***")) {
        notifications.show({
          color: "yellow",
          message: t("bilibili.notice.redactedArgs")
        });
      }
    }
    onSeedConsumed?.();
  }, [seed, onSeedConsumed]);

  useEffect(() => {
    if (active) void refreshLoginStatus();
  }, [active, refreshLoginStatus]);

  const beginLogin = () => {
    void startLogin().catch((error) =>
      notifications.show({ color: "red", message: String(error) })
    );
  };

  const logoutLogin = async () => {
    try {
      await logout();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
      throw error;
    }
  };

  const pickOutputDirectory = async () => {
    const directory = await openDialog({ directory: true });
    if (typeof directory === "string") update({ outputDirectory: directory });
  };

  const submit = async () => {
    const submittedRevision = draft.draftRevisionRef.current;
    const intent: TaskIntent =
      draft.expertText !== null
        ? { type: "manual", data: { argv: parseExpertArgv(draft.expertText) } }
        : { type: "form", data: { ...form } };
    onRetain?.();
    setSubmitting(true);
    try {
      await bilibiliSubmit(intent);
      notifications.show({ color: "green", message: t("bilibili.notice.queued") });
      if (draft.draftRevisionRef.current === submittedRevision) onSubmitted?.();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return {
    active,
    form,
    update,
    advancedOpen,
    toggleAdvanced: advanced.toggle,
    expertMode: draft.expertText !== null,
    expertText: draft.expertText,
    setExpertText: draft.setExpertText,
    enterExpert: draft.enterExpert,
    preview: draft.preview,
    previewError: draft.previewError,
    submitting,
    submit,
    loginQr,
    loginPhase,
    loginLoggedIn,
    beginLogin,
    logoutLogin,
    dismissLoginQr,
    pickOutputDirectory
  };
}
