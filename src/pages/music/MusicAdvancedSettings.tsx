import { Group, NumberInput, Stack, Text, Textarea } from "@mantine/core";
import { FieldRow } from "../../components/common/FieldRow";
import { t, type TranslationKey } from "../../locale";
import { DEFAULT_THREAD_COUNT, type MusicFormPatch, type MusicFormState } from "./configuration";

interface MusicAdvancedSettingsProps {
  form: MusicFormState;
  onChange: (patch: MusicFormPatch) => void;
}

type RawConfigField = "rawInit" | "rawRequests" | "rawThreadings" | "rawSearchRules";

const RAW_TEXTAREA_ROWS: ReadonlyArray<
  ReadonlyArray<{ field: RawConfigField; labelKey: TranslationKey }>
> = [
  [
    { field: "rawInit", labelKey: "music.advanced.initLabel" },
    { field: "rawRequests", labelKey: "music.advanced.requestsLabel" }
  ],
  [
    { field: "rawThreadings", labelKey: "music.advanced.threadingsLabel" },
    { field: "rawSearchRules", labelKey: "music.advanced.searchRulesLabel" }
  ]
];

export function MusicAdvancedSettings({ form, onChange }: MusicAdvancedSettingsProps) {
  return (
    <Stack gap="md">
      <FieldRow label={t("music.threadCount.label")} hint={t("music.threadCount.description")}>
        <NumberInput
          min={1}
          max={50}
          value={form.threadCount}
          onChange={(value) =>
            onChange({ threadCount: typeof value === "number" ? value : DEFAULT_THREAD_COUNT })
          }
        />
      </FieldRow>
      <Text size="xs" c="dimmed">
        {t("music.advanced.hint")}
      </Text>
      {RAW_TEXTAREA_ROWS.map((row) => (
        <Group key={row[0].field} grow align="start">
          {row.map(({ field, labelKey }) => (
            <Textarea
              key={field}
              label={t(labelKey)}
              autosize
              minRows={3}
              value={form[field]}
              onChange={(event) => onChange({ [field]: event.currentTarget.value })}
              styles={{
                input: { fontFamily: "monospace", fontSize: "var(--mantine-font-size-xs)" }
              }}
            />
          ))}
        </Group>
      ))}
    </Stack>
  );
}
