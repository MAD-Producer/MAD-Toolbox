import { t } from "../../locale";

interface CommandPreviewProps {
  display: string | null;
  error?: string | null;
}

/** 命令预览：错误信息或脱敏命令行（等宽换行代码块）；aria-live 播报生成/更新结果 */
export function CommandPreview({ display, error }: CommandPreviewProps) {
  return (
    <div aria-live="polite">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <code className="block whitespace-pre-wrap break-all rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
          {display ?? t("common.previewEmpty")}
        </code>
      )}
    </div>
  );
}
