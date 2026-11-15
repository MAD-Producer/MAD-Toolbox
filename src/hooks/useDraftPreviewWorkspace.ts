import { useCallback, useEffect, useRef, useState } from "react";
import type { PreviewResult, TaskIntent } from "../contracts/types";

const PREVIEW_DEBOUNCE_MS = 150;

interface RevisionedPreview {
  revision: number;
  result: PreviewResult | null;
  error: string | null;
}

export function parseExpertArgv(expertText: string): string[] {
  return expertText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

interface UseDraftPreviewWorkspaceOptions {
  active: boolean;
  onRetain?: () => void;
  /** 挂载时的专家模式初值（任务种子为手动命令时由 workspace hook 传入） */
  initialExpertText?: string | null;
  previewDisabled?: boolean;
  clearPreviewWhenDisabled?: boolean;
  buildPreviewIntent: () => TaskIntent;
  runPreview: (intent: TaskIntent) => Promise<PreviewResult>;
}

export function useDraftPreviewWorkspace({
  active,
  onRetain,
  initialExpertText = null,
  previewDisabled = false,
  clearPreviewWhenDisabled = false,
  buildPreviewIntent,
  runPreview
}: UseDraftPreviewWorkspaceOptions) {
  const [expertText, setExpertTextState] = useState<string | null>(initialExpertText);
  const [draftRevision, setDraftRevision] = useState(0);
  const [previewState, setPreviewState] = useState<RevisionedPreview | null>(null);
  const draftRevisionRef = useRef(0);

  // latest-ref 模式：让 reviseDraft 保持稳定引用（否则每次 onRetain 变化都会
  // 使 setExpertText 等回调失稳，进而在所有依赖它们的组件里放大重渲）。
  // onRetain 是父级回调而非业务状态，这里只是转发引用，不是用它隐藏状态。
  const onRetainRef = useRef(onRetain);
  useEffect(() => {
    onRetainRef.current = onRetain;
  });

  const reviseDraft = useCallback(() => {
    const nextRevision = draftRevisionRef.current + 1;
    draftRevisionRef.current = nextRevision;
    setDraftRevision(nextRevision);
    onRetainRef.current?.();
  }, []);

  const setExpertText = useCallback(
    (value: string | null) => {
      reviseDraft();
      setExpertTextState(value);
    },
    [reviseDraft]
  );

  // 【Effect 白名单⑤】草稿命令预览：表单连续编辑期间对后端做防抖预览取数。
  // 这是"派生数据 → 外部系统"的持续同步：编辑没有离散事件边界（每次按键都是变更），
  // 事件化需要在每个 mutation 点手工管理防抖计时器，等价复杂度只是换了位置。
  // 以 draftRevision 快照做版本守卫，过期响应直接丢弃。
  useEffect(() => {
    if (!active || expertText !== null) return;
    if (previewDisabled) {
      if (clearPreviewWhenDisabled) {
        setPreviewState({ revision: draftRevision, result: null, error: null });
      }
      return;
    }
    let canceled = false;
    const revision = draftRevision;
    const handle = window.setTimeout(() => {
      runPreview(buildPreviewIntent())
        .then((result) => {
          if (canceled) return;
          setPreviewState({ revision, result, error: null });
        })
        .catch((error) => {
          if (canceled) return;
          setPreviewState({ revision, result: null, error: String(error) });
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      canceled = true;
      window.clearTimeout(handle);
    };
  }, [
    active,
    expertText,
    previewDisabled,
    clearPreviewWhenDisabled,
    draftRevision,
    buildPreviewIntent,
    runPreview
  ]);

  const enterExpert = useCallback(() => {
    if (previewState?.revision === draftRevisionRef.current && previewState.result !== null) {
      setExpertText(previewState.result.argv.join("\n"));
    }
  }, [previewState, setExpertText]);

  const resetPreview = useCallback(() => setPreviewState(null), []);

  return {
    expertText,
    setExpertText,
    restoreExpertText: setExpertTextState,
    enterExpert,
    preview: previewState?.result ?? null,
    previewError: previewState?.error ?? null,
    draftRevisionRef,
    reviseDraft,
    resetPreview
  };
}
