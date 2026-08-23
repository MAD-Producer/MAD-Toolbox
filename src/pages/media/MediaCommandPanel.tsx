import { Button, Divider, Group, Stack, Text, Textarea } from "@mantine/core";
import { IconPencil, IconRotate } from "@tabler/icons-react";
import type { PreviewResult } from "./api";
import { CommandPreview } from "../../components/common/CommandPreview";
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
  withDivider?: boolean;
}

export function MediaCommandPanel({
  isPr,
  expertMode,
  expertText,
  preview,
  previewError,
  onEnterExpert,
  onExitExpert,
  onExpertTextChange,
  withDivider
}: MediaCommandPanelProps) {
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {isPr
            ? t("media.op.prCompatible")
            : expertMode
              ? t("media.command.expertTitle")
              : t("media.command.previewTitle")}
        </Text>
        {!isPr &&
          (expertMode ? (
            <Button
              size="compact-sm"
              variant="light"
              leftSection={<IconRotate size={14} />}
              onClick={onExitExpert}
            >
              {t("media.command.restoreForm")}
            </Button>
          ) : (
            <Button
              size="compact-sm"
              variant="light"
              leftSection={<IconPencil size={14} />}
              onClick={onEnterExpert}
              disabled={!preview}
            >
              {t("media.command.editCommand")}
            </Button>
          ))}
      </Group>
      {isPr ? (
        <Text size="sm" c="dimmed">
          {t("media.command.prDescription")}
        </Text>
      ) : expertMode ? (
        <>
          <Text size="xs" c="yellow">
            {t("media.command.expertNotice")}
          </Text>
          <Textarea
            autosize
            minRows={4}
            value={expertText ?? ""}
            onChange={(event) => onExpertTextChange(event.currentTarget.value)}
            styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
          />
        </>
      ) : (
        <CommandPreview display={preview?.display ?? null} error={previewError} />
      )}
      {withDivider && <Divider my={4} />}
    </Stack>
  );
}
