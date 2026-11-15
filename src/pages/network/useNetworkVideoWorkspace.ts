import { notifications } from "../../lib/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import type { TaskIntent, TaskSeed } from "../../contracts/types";
import type { CookieFileOption } from "../../contracts/types";
import type { CookieVerificationStatus } from "../../components/common/CookieFileField";
import { parseExpertArgv, useDraftPreviewWorkspace } from "../../hooks/useDraftPreviewWorkspace";
import { networkPreview, networkProbe, networkSubmit, type ProbeKind } from "./api";
import { defaultNetworkForm, type NetworkFormState } from "./form";
import { loadStoredForm, saveStoredForm } from "../../lib/formStorage";
import { t } from "../../locale";

const NETWORK_FORM_STORAGE_KEY = "network.form";

export interface NetworkVideoPageProps {
  active: boolean;
  seed?: TaskSeed | null;
  onRetain?: () => void;
  onSubmitted?: () => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
  globalProxy?: string | null;
  cookieFiles: CookieFileOption[];
  onAddCookieFile?: () => void;
}

export interface NetworkProbeResult {
  title: string;
  text: string;
}

export function useNetworkVideoWorkspace({
  active,
  seed,
  onRetain,
  onSubmitted
}: NetworkVideoPageProps) {
  // 任务种子只在挂载时消费一次（deliver → generation+1 → 重挂）；无种子时读持久化草稿
  const [form, setForm] = useState<NetworkFormState>(() => {
    if (seed?.task.intent.type === "form") {
      const restored = {
        ...defaultNetworkForm,
        ...(seed.task.intent.data as Partial<NetworkFormState>)
      };
      if (seed.purpose === "reuse") restored.url = "";
      return restored;
    }
    return loadStoredForm(NETWORK_FORM_STORAGE_KEY, defaultNetworkForm);
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const toggleAdvanced = useCallback(() => setAdvancedOpen((open) => !open), []);
  const [submitting, setSubmitting] = useState(false);
  const [probeResult, setProbeResult] = useState<NetworkProbeResult | null>(null);
  const [probing, setProbing] = useState<ProbeKind | null>(null);
  const [verifyingCookie, setVerifyingCookie] = useState(false);
  const [cookieVerification, setCookieVerification] = useState<CookieVerificationStatus>("idle");

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
    runPreview: networkPreview
  });

  const update = (patch: Partial<NetworkFormState>) => {
    draft.reviseDraft();
    if (patch.url !== undefined || patch.cookiesFile !== undefined) {
      setCookieVerification("idle");
    }
    setForm((current) => ({ ...current, ...patch }));
  };

  // 【Effect 白名单⑤】表单草稿持久化到 localStorage（同 bilibili 工作区）
  useEffect(() => {
    const { url, ...persisted } = form;
    saveStoredForm(NETWORK_FORM_STORAGE_KEY, persisted);
  }, [form]);

  const submit = async () => {
    const submittedRevision = draft.draftRevisionRef.current;
    const intent: TaskIntent =
      draft.expertText !== null
        ? { type: "manual", data: { argv: parseExpertArgv(draft.expertText) } }
        : { type: "form", data: { ...form } };
    onRetain?.();
    setSubmitting(true);
    try {
      await networkSubmit(intent);
      notifications.show({ color: "green", message: t("network.submitted") });
      if (draft.draftRevisionRef.current === submittedRevision) onSubmitted?.();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const probe = async (kind: ProbeKind) => {
    const requestedRevision = draft.draftRevisionRef.current;
    setProbing(kind);
    try {
      const text = await networkProbe({ type: "form", data: { ...form } }, kind);
      if (draft.draftRevisionRef.current === requestedRevision) {
        setProbeResult({
          title:
            kind === "formats" ? t("network.probe.formatsTitle") : t("network.probe.metadataTitle"),
          text
        });
      }
    } catch (error) {
      if (draft.draftRevisionRef.current === requestedRevision) {
        notifications.show({ color: "red", message: String(error) });
      }
    } finally {
      setProbing(null);
    }
  };

  const verifyCookie = async () => {
    if (!form.url.trim()) {
      notifications.show({ color: "yellow", message: t("network.cookieVerify.urlRequired") });
      return;
    }
    if (!form.cookiesFile.trim()) {
      notifications.show({ color: "yellow", message: t("network.cookieVerify.fileRequired") });
      return;
    }

    const requestedRevision = draft.draftRevisionRef.current;
    setCookieVerification("idle");
    setVerifyingCookie(true);
    try {
      await networkProbe({ type: "form", data: { ...form } }, "cookie");
      if (draft.draftRevisionRef.current !== requestedRevision) return;
      setCookieVerification("valid");
      notifications.show({ color: "green", message: t("network.cookieVerify.valid") });
    } catch (error) {
      if (draft.draftRevisionRef.current !== requestedRevision) return;
      setCookieVerification("invalid");
      const reason = String(error)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .pop();
      notifications.show({
        color: "red",
        message: reason
          ? `${t("network.cookieVerify.invalid")}: ${reason}`
          : t("network.cookieVerify.invalid")
      });
    } finally {
      setVerifyingCookie(false);
    }
  };

  const pickOutputDirectory = async () => {
    const directory = await openDialog({ directory: true });
    if (typeof directory === "string") update({ outputDirectory: directory });
  };

  const pickCookieFile = async () => {
    const file = await openDialog({ multiple: false, directory: false });
    if (typeof file === "string") update({ cookiesFile: file });
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
    probeResult,
    setProbeResult,
    probing,
    probe,
    verifyingCookie,
    cookieVerification,
    verifyCookie,
    pickOutputDirectory,
    pickCookieFile
  };
}
