import { useDisclosure } from "@mantine/hooks";
import { notifications } from "../../lib/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import type { TaskIntent, TaskSeed } from "../../contracts/types";
import {
  networkPreview,
  networkProbe,
  networkSubmit,
  type PreviewResult,
  type ProbeKind
} from "./api";
import { defaultNetworkForm, type NetworkFormState } from "./form";
import { resolveDefaultOutputDirectory } from "../../lib/platform";

export interface NetworkVideoPageProps {
  active: boolean;
  seed?: TaskSeed | null;
  onSeedConsumed?: () => void;
  onRetain?: () => void;
  onSubmitted?: () => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
  /** 设置页的全局代理；留空提交时代理即经环境变量下发 */
  globalProxy?: string | null;
}

export interface NetworkProbeResult {
  title: string;
  text: string;
}

interface RevisionedPreview {
  revision: number;
  result: PreviewResult | null;
  error: string | null;
}

export function useNetworkVideoWorkspace({
  active,
  seed,
  onSeedConsumed,
  onRetain,
  onSubmitted
}: NetworkVideoPageProps) {
  const [form, setForm] = useState<NetworkFormState>(defaultNetworkForm);
  const [advancedOpen, advanced] = useDisclosure(false);
  const [expertText, setExpertTextState] = useState<string | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [previewState, setPreviewState] = useState<RevisionedPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [probeResult, setProbeResult] = useState<NetworkProbeResult | null>(null);
  const [probing, setProbing] = useState<ProbeKind | null>(null);
  const draftRevisionRef = useRef(0);
  const previewStateRef = useRef<RevisionedPreview | null>(null);
  previewStateRef.current = previewState;

  const reviseDraft = () => {
    const nextRevision = draftRevisionRef.current + 1;
    draftRevisionRef.current = nextRevision;
    setDraftRevision(nextRevision);
    onRetain?.();
  };

  const update = (patch: Partial<NetworkFormState>) => {
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
        ...defaultNetworkForm,
        ...(seed.task.intent.data as Partial<NetworkFormState>)
      };
      // 复用配置只还原参数，url 是每次任务不同的输入，留空待填
      if (seed.purpose === "reuse") restored.url = "";
      setForm(restored);
    } else {
      setExpertTextState(seed.task.intent.data.argv.join("\n"));
      if (seed.task.intent.data.argv.some((argument) => argument === "***")) {
        notifications.show({
          color: "yellow",
          message: "手改命令中的敏感值（***）未被保存，请重新填写后再运行"
        });
      }
    }
    onSeedConsumed?.();
  }, [seed, onSeedConsumed]);

  useEffect(() => {
    if (!active || expertText !== null) return;
    let canceled = false;
    const revision = draftRevision;
    const handle = window.setTimeout(() => {
      const intent: TaskIntent = { type: "form", data: { ...form } };
      networkPreview(intent)
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

  const enterExpert = () => {
    const currentPreview = previewStateRef.current;
    if (currentPreview?.revision === draftRevisionRef.current && currentPreview.result !== null) {
      setExpertText(currentPreview.result.argv.join("\n"));
    }
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
      await networkSubmit(intent);
      notifications.show({ color: "green", message: "任务已加入队列" });
      if (draftRevisionRef.current === submittedRevision) onSubmitted?.();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const probe = async (kind: ProbeKind) => {
    const requestedRevision = draftRevisionRef.current;
    setProbing(kind);
    try {
      const text = await networkProbe({ type: "form", data: { ...form } }, kind);
      if (draftRevisionRef.current === requestedRevision) {
        setProbeResult({ title: kind === "formats" ? "可用格式" : "元数据", text });
      }
    } catch (error) {
      if (draftRevisionRef.current === requestedRevision) {
        notifications.show({ color: "red", message: String(error) });
      }
    } finally {
      setProbing(null);
    }
  };

  const pickOutputDirectory = async () => {
    const directory = await openDialog({ directory: true });
    if (typeof directory === "string") update({ outputDirectory: directory });
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
    probeResult,
    setProbeResult,
    probing,
    probe,
    pickOutputDirectory
  };
}
