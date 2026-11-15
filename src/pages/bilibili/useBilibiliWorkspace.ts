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
  onRetain?: () => void;
  onSubmitted?: () => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

export function useBilibiliWorkspace({ active, seed, onRetain, onSubmitted }: BilibiliPageProps) {
  // 任务种子只在挂载时消费一次（deliver → generation+1 → 重挂），表单按种子恢复；
  // 无种子时读持久化草稿
  const [form, setForm] = useState<BilibiliFormState>(() => {
    if (seed?.task.intent.type === "form") {
      const restored = {
        ...defaultBilibiliForm,
        ...(seed.task.intent.data as Partial<BilibiliFormState>)
      };
      if (seed.purpose === "reuse") restored.url = "";
      return restored;
    }
    return loadStoredForm(BILIBILI_FORM_STORAGE_KEY, defaultBilibiliForm);
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const toggleAdvanced = useCallback(() => setAdvancedOpen((open) => !open), []);
  const [submitting, setSubmitting] = useState(false);
  const loginQr = useBilibiliLoginStore((state) => state.qrDataUrl);
  const loginPhase = useBilibiliLoginStore((state) => state.phase);
  const loginLoggedIn = useBilibiliLoginStore((state) => state.loggedIn);
  const startLogin = useBilibiliLoginStore((state) => state.start);
  const logout = useBilibiliLoginStore((state) => state.logout);
  const dismissLoginQr = useBilibiliLoginStore((state) => state.dismissQr);

  const buildPreviewIntent = useCallback(
    (): TaskIntent => ({ type: "form", data: { ...form } }),
    [form]
  );
  const draft = useDraftPreviewWorkspace({
    active,
    onRetain,
    initialExpertText:
      seed?.task.intent.type === "manual" ? seed.task.intent.data.argv.join("\n") : null,
    buildPreviewIntent,
    runPreview: bilibiliPreview
  });

  const update = (patch: Partial<BilibiliFormState>) => {
    draft.reviseDraft();
    setForm((current) => ({ ...current, ...patch }));
  };

  // 【Effect 白名单⑤】表单草稿持久化到 localStorage：与 BilibiliPage 挂载期的
  // loadStoredForm 初始化构成一对读写。表单是持续镜像的外部草稿，不参与渲染派生。
  useEffect(() => {
    const { url, ...persisted } = form;
    saveStoredForm(BILIBILI_FORM_STORAGE_KEY, persisted);
  }, [form]);

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
    toggleAdvanced,
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
