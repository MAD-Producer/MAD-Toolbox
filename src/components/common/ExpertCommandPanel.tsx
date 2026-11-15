import { IconPencil, IconRotate } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import type { PreviewResult } from "../../contracts/types";
import { t, type TranslationKey } from "../../locale";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Tooltip } from "../ui/tooltip";
import { CommandPreview } from "./CommandPreview";


interface ExpertCommandPanelLabels {
  previewTitle: TranslationKey;
  expertTitle: TranslationKey;
  restoreForm: TranslationKey;
  editCommand: TranslationKey;
  expertWarning: TranslationKey;
}

interface ExpertCommandPanelProps {
  labels: ExpertCommandPanelLabels;
  expertText: string | null;
  preview: PreviewResult | null;
  previewError: string | null;
  onEnterExpert: () => void;
  onExitExpert: () => void;
  onExpertTextChange: (value: string) => void;
}

/** 专家命令面板：预览态 ↔ 编辑态切换；编辑态为等宽自适应高度文本域 */
export function ExpertCommandPanel({
  labels,
  expertText,
  preview,
  previewError,
  onEnterExpert,
  onExitExpert,
  onExpertTextChange
}: ExpertCommandPanelProps) {
  const expertMode = expertText !== null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const prevExpertRef = useRef(expertMode);

  // 进入专家模式时把焦点交给文本域；退出时焦点接回"编辑命令"，避免坠到 body
  useEffect(() => {
    if (expertMode) textareaRef.current?.focus();
    else if (prevExpertRef.current) editButtonRef.current?.focus();
    prevExpertRef.current = expertMode;
  }, [expertMode]);

  // 预览未就绪时按钮禁用：包一层 span 桥接 Tooltip（IconButton/Button 禁用态 pointer-events-none 会阻断 hover）
  const editButton = (
    <Button
      ref={editButtonRef}
      size="sm"
      variant="secondary"
      className="h-8 gap-1.5 px-2.5 text-xs"
      leftSection={<IconPencil size={14} stroke={1.8} />}
      onClick={onEnterExpert}
      disabled={!preview}
    >
      {t(labels.editCommand)}
    </Button>
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {expertMode ? t(labels.expertTitle) : t(labels.previewTitle)}
        </span>
        {expertMode ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 px-2.5 text-xs"
            leftSection={<IconRotate size={14} stroke={1.8} />}
            onClick={onExitExpert}
          >
            {t(labels.restoreForm)}
          </Button>
        ) : preview ? (
          editButton
        ) : (
          <Tooltip label={previewError ?? t("common.submitWaitingPreview")}>
            <span className="inline-flex">{editButton}</span>
          </Tooltip>
        )}
      </div>
      {expertMode ? (
        <>
          <p className="text-xs font-medium text-warning">{t(labels.expertWarning)}</p>
          <Textarea
            ref={textareaRef}
            autosize
            rows={4}
            value={expertText}
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
