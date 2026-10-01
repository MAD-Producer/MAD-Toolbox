import { useCallback, useEffect, useRef, useState } from "react";
import type { PreviewResult, TaskIntent } from "../contracts/types";
import { resolveDefaultOutputDirectory } from "../lib/platform";

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
  previewDisabled?: boolean;
  clearPreviewWhenDisabled?: boolean;
  buildPreviewIntent: () => TaskIntent;
  runPreview: (intent: TaskIntent) => Promise<PreviewResult>;
  onDefaultOutputDirectory: (directory: string) => void;
}

export function useDraftPreviewWorkspace({
  active,
  onRetain,
  previewDisabled = false,
  clearPreviewWhenDisabled = false,
  buildPreviewIntent,
  runPreview,
  onDefaultOutputDirectory
}: UseDraftPreviewWorkspaceOptions) {
  const [expertText, setExpertTextState] = useState<string | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [previewState, setPreviewState] = useState<RevisionedPreview | null>(null);
  const draftRevisionRef = useRef(0);

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

  useEffect(() => {
    let canceled = false;
    void resolveDefaultOutputDirectory().then((directory) => {
      if (!canceled && directory) onDefaultOutputDirectory(directory);
    });
    return () => {
      canceled = true;
    };
  }, []);

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
