import { NumberInput, Stack, Textarea, TextInput } from "@mantine/core";
import { FieldRow } from "../../components/common/FieldRow";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
import { t } from "../../locale";
import type { MusicFormPatch, MusicFormState } from "./configuration";

interface MusicConfigurationPanelProps {
  form: MusicFormState;
  onChange: (patch: MusicFormPatch) => void;
  onPickOutputDirectory: () => void;
  /** 设置页的全局代理；已设置时作为占位提示，留空提交即使用它 */
  globalProxy?: string | null;
}

export function MusicConfigurationPanel({
  form,
  onChange,
  onPickOutputDirectory,
  globalProxy
}: MusicConfigurationPanelProps) {
  return (
    <Stack gap="md">
      <FieldRow
        label={form.mode === "search" ? t("music.keyword.label") : t("music.playlistUrl.label")}
        hint={form.mode === "playlist" ? t("music.playlistUrl.description") : undefined}
      >
        {form.mode === "search" ? (
          <TextInput
            placeholder={t("music.keyword.placeholder")}
            value={form.keyword}
            onChange={(event) => onChange({ keyword: event.currentTarget.value })}
          />
        ) : (
          <TextInput
            placeholder="https://music.163.com/#/playlist?id=..."
            value={form.playlistUrl}
            onChange={(event) => onChange({ playlistUrl: event.currentTarget.value })}
          />
        )}
      </FieldRow>
      <FieldRow label={t("music.outputDirectory")} hint={t("common.outputDirectoryHint")}>
        <OutputDirectoryField
          bare
          value={form.outputDirectory}
          disabled={false}
          placeholder={t("music.outputDirectory.placeholder")}
          onChange={(outputDirectory) => onChange({ outputDirectory })}
          onBrowse={async () => onPickOutputDirectory()}
        />
      </FieldRow>
      <FieldRow label={t("music.searchSize.label")} hint={t("music.searchSize.description")}>
        <NumberInput
          min={1}
          max={100}
          value={form.searchSize}
          onChange={(value) => onChange({ searchSize: typeof value === "number" ? value : 5 })}
        />
      </FieldRow>
      <FieldRow label={t("music.proxy.label")}>
        <TextInput
          placeholder={globalProxy ?? "http://127.0.0.1:7890"}
          value={form.proxy}
          onChange={(event) => onChange({ proxy: event.currentTarget.value })}
        />
      </FieldRow>
      <FieldRow label={t("music.cookies.label")}>
        <Textarea
          autosize
          minRows={1}
          value={form.cookies}
          onChange={(event) => onChange({ cookies: event.currentTarget.value })}
        />
      </FieldRow>
    </Stack>
  );
}
