import { Button, Group, Stack, Text, Textarea } from "@mantine/core";
import { IconPencil, IconRotate } from "@tabler/icons-react";
import type { PreviewResult } from "../../contracts/types";
import { t, type TranslationKey } from "../../locale";
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

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {expertMode ? t(labels.expertTitle) : t(labels.previewTitle)}
        </Text>
        {expertMode ? (
          <Button
            size="compact-sm"
            variant="light"
            leftSection={<IconRotate size={14} />}
            onClick={onExitExpert}
          >
            {t(labels.restoreForm)}
          </Button>
        ) : (
          <Button
            size="compact-sm"
            variant="light"
            leftSection={<IconPencil size={14} />}
            onClick={onEnterExpert}
            disabled={!preview}
          >
            {t(labels.editCommand)}
          </Button>
        )}
      </Group>
      {expertMode ? (
        <>
          <Text size="xs" c="yellow">
            {t(labels.expertWarning)}
          </Text>
          <Textarea
            autosize
            minRows={4}
            value={expertText}
            onChange={(event) => onExpertTextChange(event.currentTarget.value)}
            styles={{ input: { fontFamily: "monospace", fontSize: "var(--mantine-font-size-xs)" } }}
          />
        </>
      ) : (
        <CommandPreview display={preview?.display ?? null} error={previewError} />
      )}
    </Stack>
  );
}
