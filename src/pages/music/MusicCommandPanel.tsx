import { Stack, Text } from "@mantine/core";
import { CommandPreview } from "../../components/common/CommandPreview";
import { t } from "../../locale";
import { isSearchBusy, type MusicSessionPhase } from "../../stores/music-session";

interface MusicCommandPanelProps {
  preview: string | null;
  previewError: string | null;
  sessionPhase: MusicSessionPhase;
  sourceCount: number;
}

export function MusicCommandPanel({
  preview,
  previewError,
  sessionPhase,
  sourceCount
}: MusicCommandPanelProps) {
  const searchInProgress = isSearchBusy(sessionPhase);

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        {t("music.preview.title")}
      </Text>
      <Text size="xs" c="dimmed">
        {t("music.preview.hint")}
      </Text>
      <CommandPreview display={preview} error={previewError} />
      {searchInProgress && (
        <Text size="sm" c="dimmed">
          {sessionPhase === "starting"
            ? t("music.preview.starting")
            : sessionPhase === "canceling"
              ? t("music.preview.canceling")
              : t("music.preview.searching", { count: sourceCount })}
        </Text>
      )}
    </Stack>
  );
}
