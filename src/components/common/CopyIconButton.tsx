import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../../locale";
import { IconButton } from "../ui/icon-button";
import { Tooltip } from "../ui/tooltip";

const COPIED_RESET_MS = 2000;

interface CopyIconButtonProps {
  value: string;
  label: string;
}

/** 复制按钮：点击复制 value，2 秒后从成功态复原 */
export function CopyIconButton({ value, label }: CopyIconButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  const copy = useCallback(() => {
    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
      })
      .catch(() => setCopied(false));
  }, [value]);

  // 卸载时清掉复原倒计时
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  return (
    <Tooltip label={copied ? t("common.copied") : label}>
      <IconButton
        label={label}
        variant="ghost"
        onClick={copy}
        className={copied ? "text-success hover:text-success" : "text-muted-foreground"}
      >
        {copied ? <IconCheck size={16} stroke={1.8} /> : <IconCopy size={16} stroke={1.8} />}
      </IconButton>
    </Tooltip>
  );
}
