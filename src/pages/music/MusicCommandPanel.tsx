import { CommandPreview } from "../../components/common/CommandPreview";
import { t } from "../../locale";
import { isSearchBusy, type MusicSessionPhase } from "../../stores/music-session";

interface MusicCommandPanelProps {
  preview: string | null;
  previewError: string | null;
  sessionPhase: MusicSessionPhase;
  sourceCount: number;
}

/** 命令预览卡片内容：脱敏命令行 + 搜索进行中提示 */
export function MusicCommandPanel({
  preview,
  previewError,
  sessionPhase,
  sourceCount
}: MusicCommandPanelProps) {
  const searchInProgress = isSearchBusy(sessionPhase);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">{t("music.preview.title")}</p>
      <p className="text-xs text-muted-foreground">{t("music.preview.hint")}</p>
      <CommandPreview display={preview} error={previewError} />
      {searchInProgress && (
        <p className="text-sm text-muted-foreground">
          {sessionPhase === "starting"
            ? t("music.preview.starting")
            : sessionPhase === "canceling"
              ? t("music.preview.canceling")
              : t("music.preview.searching", { count: sourceCount })}
        </p>
      )}
    </div>
  );
}
