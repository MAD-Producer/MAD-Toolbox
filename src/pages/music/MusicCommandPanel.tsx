import { Code, Divider, Stack, Text } from "@mantine/core";
import { t } from "../../locale";
import type { MusicSessionPhase } from "../../stores/music-session";

interface MusicCommandPanelProps {
  preview: string | null;
  previewError: string | null;
  sessionPhase: MusicSessionPhase;
  sourceCount: number;
  withDivider?: boolean;
}

export function MusicCommandPanel({
  preview,
  previewError,
  sessionPhase,
  sourceCount,
  withDivider
}: MusicCommandPanelProps) {
  const searchInProgress =
    sessionPhase === "starting" || sessionPhase === "searching" || sessionPhase === "canceling";

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        {t("music.preview.title")}
      </Text>
      <Text size="xs" c="dimmed">
        {t("music.preview.hint")}
      </Text>
      {previewError ? (
        <Text size="sm" c="red">
          {previewError}
        </Text>
      ) : (
        <Code block style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {preview ?? "…"}
        </Code>
      )}
      {searchInProgress && (
        <Text size="sm" c="dimmed">
          {sessionPhase === "starting"
            ? t("music.preview.starting")
            : sessionPhase === "canceling"
              ? t("music.preview.canceling")
              : t("music.preview.searching", { count: sourceCount })}
        </Text>
      )}
      {withDivider && <Divider my={4} />}
    </Stack>
  );
}
