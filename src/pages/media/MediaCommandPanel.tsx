import { Pencil, ArrowCounterClockwise } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import type { PreviewResult } from "./api";
import { CommandPreview } from "../../components/common/CommandPreview";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Tooltip } from "../../components/ui/tooltip";
import { t } from "../../locale";

interface MediaCommandPanelProps {
  isPr: boolean;
  expertMode: boolean;
  expertText: string | null;
  preview: PreviewResult | null;
  previewError: string | null;
  onEnterExpert: () => void;
  onExitExpert: () => void;
  onExpertTextChange: (value: string) => void;
}

/** 命令面板：PR 模式纯说明；其余模式预览 ↔ 专家编辑切换（与 ExpertCommandPanel 同构） */
export function MediaCommandPanel({
  isPr,
  expertMode,
  expertText,
  preview,
  previewError,
  onEnterExpert,
  onExitExpert,
  onExpertTextChange
}: MediaCommandPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const prevExpertRef = useRef(expertMode);

  // 进入专家模式时把焦点交给文本域；退出时焦点接回"编辑命令"，避免坠到 body
  useEffect(() => {
    if (expertMode) textareaRef.current?.focus();
    else if (prevExpertRef.current) editButtonRef.current?.focus();
    prevExpertRef.current = expertMode;
  }, [expertMode]);

  const title = isPr
    ? t("media.op.prCompatible")
    : expertMode
      ? t("media.command.expertTitle")
      : t("media.command.previewTitle");

  const editButton = (
    <Button
      ref={editButtonRef}
      size="sm"
      variant="secondary"
      className="h-8 gap-1.5 px-2.5 text-xs"
      leftSection={<Pencil size={14} />}
      onClick={onEnterExpert}
      disabled={!preview}
    >
      {t("media.command.editCommand")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        {!isPr &&
          (expertMode ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 px-2.5 text-xs"
              leftSection={<ArrowCounterClockwise size={14} />}
              onClick={onExitExpert}
            >
              {t("media.command.restoreForm")}
            </Button>
          ) : preview ? (
            editButton
          ) : (
            <Tooltip label={previewError ?? t("media.command.waitingPreview")}>
              <span className="inline-flex">{editButton}</span>
            </Tooltip>
          ))}
      </div>
      {isPr ? (
        <p className="text-sm text-muted-foreground">{t("media.command.prDescription")}</p>
      ) : expertMode ? (
        <>
          <p className="text-xs font-medium text-warning">{t("media.command.expertNotice")}</p>
          <Textarea
            ref={textareaRef}
            autosize
            rows={4}
            value={expertText ?? ""}
            onChange={(event) => onExpertTextChange(event.currentTarget.value)}
            className="min-h-0 font-mono text-xs"
          />
        </>
      ) : (
        <CommandPreview display={preview?.display ?? null} error={previewError} />
      )}
    </div>
  );
}
