import { Group, Stack, Text, Textarea } from "@mantine/core";
import { t } from "../../locale";
import type { MusicFormPatch, MusicFormState } from "./configuration";

interface MusicAdvancedSettingsProps {
  form: MusicFormState;
  onChange: (patch: MusicFormPatch) => void;
}

export function MusicAdvancedSettings({ form, onChange }: MusicAdvancedSettingsProps) {
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">
        {t("music.advanced.hint")}
      </Text>
      <Group grow align="start">
        <Textarea
          label={t("music.advanced.initLabel")}
          autosize
          minRows={3}
          value={form.rawInit}
          onChange={(event) => onChange({ rawInit: event.currentTarget.value })}
          styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
        />
        <Textarea
          label={t("music.advanced.requestsLabel")}
          autosize
          minRows={3}
          value={form.rawRequests}
          onChange={(event) => onChange({ rawRequests: event.currentTarget.value })}
          styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
        />
      </Group>
      <Group grow align="start">
        <Textarea
          label={t("music.advanced.threadingsLabel")}
          autosize
          minRows={3}
          value={form.rawThreadings}
          onChange={(event) => onChange({ rawThreadings: event.currentTarget.value })}
          styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
        />
        <Textarea
          label={t("music.advanced.searchRulesLabel")}
          autosize
          minRows={3}
          value={form.rawSearchRules}
          onChange={(event) => onChange({ rawSearchRules: event.currentTarget.value })}
          styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
        />
      </Group>
    </Stack>
  );
}
