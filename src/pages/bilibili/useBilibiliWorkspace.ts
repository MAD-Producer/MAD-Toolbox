import { useDisclosure } from "@mantine/hooks";
import { notifications } from "../../lib/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import type { TaskIntent, TaskSeed } from "../../contracts/types";
import { t } from "../../locale";
import { bilibiliPreview, bilibiliSubmit, type PreviewResult } from "./api";
import { defaultBilibiliForm, type BilibiliFormState } from "./form";
import { loadStoredForm, saveStoredForm } from "../../lib/formStorage";
import { resolveDefaultOutputDirectory } from "../../lib/platform";
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

interface RevisionedPreview {
  revision: number;
  result: PreviewResult | null;
  error: string | null;
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
  const [expertText, setExpertTextState] = useState<string | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [previewState, setPreviewState] = useState<RevisionedPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const loginQr = useBilibiliLoginStore((state) => state.qrDataUrl);
  const loginPhase = useBilibiliLoginStore((state) => state.phase);
  const loginLoggedIn = useBilibiliLoginStore((state) => state.loggedIn);
  const startLogin = useBilibiliLoginStore((state) => state.start);
  const refreshLoginStatus = useBilibiliLoginStore((state) => state.refresh);
  const dismissLoginQr = useBilibiliLoginStore((state) => state.dismissQr);
  const draftRevisionRef = useRef(0);
  const previewStateRef = useRef<RevisionedPreview | null>(null);
  previewStateRef.current = previewState;

  const reviseDraft = () => {
    const nextRevision = draftRevisionRef.current + 1;
    draftRevisionRef.current = nextRevision;
    setDraftRevision(nextRevision);
    onRetain?.();
  };

  const update = (patch: Partial<BilibiliFormState>) => {
    reviseDraft();
    setForm((current) => ({ ...current, ...patch }));
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

  useEffect(() => {
    const { url, ...persisted } = form;
    saveStoredForm(BILIBILI_FORM_STORAGE_KEY, persisted);
  }, [form]);

  const setExpertText = (value: string | null) => {
    reviseDraft();
    setExpertTextState(value);
  };

  useEffect(() => {
    if (!seed) return;
    setPreviewState(null);
    if (seed.task.intent.type === "form") {
      setExpertTextState(null);
      const restored = {
        ...defaultBilibiliForm,
        ...(seed.task.intent.data as Partial<BilibiliFormState>)
      };
      // 复用配置只还原参数
      if (seed.purpose === "reuse") restored.url = "";
      setForm(restored);
    } else {
      setExpertTextState(seed.task.intent.data.argv.join("\n"));
      if (seed.task.intent.data.argv.some((argument) => argument === "***")) {
        notifications.show({
          color: "yellow",
          message: t("bilibili.notice.redactedArgs")
        });
      }
    }
    onSeedConsumed?.();
  }, [seed, onSeedConsumed]);

  // 每次进入页面都重新读取落盘登录态：覆盖「上次会话已登录」「关窗后后台扫码完成」等场景
  useEffect(() => {
    if (active) void refreshLoginStatus();
  }, [active, refreshLoginStatus]);

  useEffect(() => {
    if (!active || expertText !== null) return;
    let canceled = false;
    const revision = draftRevision;
    const handle = window.setTimeout(() => {
      const intent: TaskIntent = { type: "form", data: { ...form } };
      bilibiliPreview(intent)
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
  }, [active, draftRevision, form, expertText]);

  const beginLogin = () => {
    void startLogin().catch((error) =>
      notifications.show({ color: "red", message: String(error) })
    );
  };

  const enterExpert = () => {
    const currentPreview = previewStateRef.current;
    if (currentPreview?.revision === draftRevisionRef.current && currentPreview.result !== null) {
      setExpertText(currentPreview.result.argv.join("\n"));
    }
  };

  const pickOutputDirectory = async () => {
    const directory = await openDialog({ directory: true });
    if (typeof directory === "string") update({ outputDirectory: directory });
  };

  const submit = async () => {
    const submittedRevision = draftRevisionRef.current;
    const intent: TaskIntent =
      expertText !== null
        ? {
            type: "manual",
            data: {
              argv: expertText
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
            }
          }
        : { type: "form", data: { ...form } };
    onRetain?.();
    setSubmitting(true);
    try {
      await bilibiliSubmit(intent);
      notifications.show({ color: "green", message: t("bilibili.notice.queued") });
      if (draftRevisionRef.current === submittedRevision) onSubmitted?.();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    } finally {
      setSubmitting(false);
    }
  };

  // 草稿变更后沿用上一次预览直到新结果整体替换，避免「…」与命令交替导致高度抖动
  const preview = previewState?.result ?? null;
  const previewError = previewState?.error ?? null;

  return {
    active,
    form,
    update,
    advancedOpen,
    toggleAdvanced: advanced.toggle,
    expertMode: expertText !== null,
    expertText,
    setExpertText,
    enterExpert,
    preview,
    previewError,
    submitting,
    submit,
    loginQr,
    loginPhase,
    loginLoggedIn,
    beginLogin,
    dismissLoginQr,
    pickOutputDirectory
  };
}
