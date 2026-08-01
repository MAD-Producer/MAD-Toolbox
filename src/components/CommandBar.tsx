import { Check, Copy, Play } from "lucide-react";
import { useState } from "react";

interface CommandBarProps {
  command: string;
  disabled?: boolean;
  disabledReason?: string;
  onRun: () => void;
}

export function CommandBar({ command, disabled, disabledReason, onRun }: CommandBarProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  return (
    <div className="command-bar">
      <div className="command-preview">
        <span className="command-kicker">任务摘要</span>
        <code>{command || "请先填写输入内容"}</code>
      </div>
      {copyState !== "idle" && (
        <span className={`copy-feedback command-copy-feedback ${copyState}`} role="status">
          {copyState === "copied" ? "已复制" : "复制失败"}
        </span>
      )}
      <button
        className="icon-button"
        type="button"
        title={copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制命令"}
        aria-label={copyState === "copied" ? "命令已复制" : "复制命令"}
        onClick={() => void copyCommand()}
        disabled={!command}
      >
        {copyState === "copied" ? <Check className="copy-success-icon" size={16} /> : <Copy size={16} />}
      </button>
      <button
        className="primary-button"
        type="button"
        onClick={onRun}
        disabled={disabled}
        title={disabled ? disabledReason : "运行"}
      >
        <Play size={16} fill="currentColor" />
        运行
      </button>
    </div>
  );
}
