import { NumberInput, Stack, TextInput } from "@mantine/core";
import { CookieFileField } from "../../components/common/CookieFileField";
import { FieldRow } from "../../components/common/FieldRow";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
import { resolveDefaultOutputDirectory } from "../../lib/platform";
import { t } from "../../locale";
import type { MusicFormPatch, MusicFormState } from "./configuration";

interface MusicConfigurationPanelProps {
  form: MusicFormState;
  onChange: (patch: MusicFormPatch) => void;
  onPickOutputDirectory: () => void;
  onPickCookieFile: () => void;
  globalProxy?: string | null;
  defaultOutputDirectory?: string | null;
}

export function MusicConfigurationPanel({
  form,
  onChange,
  onPickOutputDirectory,
  onPickCookieFile,
  globalProxy,
  defaultOutputDirectory
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
          resolveDefault={
            defaultOutputDirectory
              ? () => Promise.resolve(defaultOutputDirectory)
              : resolveDefaultOutputDirectory
          }
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
      <FieldRow label={t("music.cookies.label")} hint={t("music.cookies.hint")}>
        <CookieFileField
          value={form.cookiesFile}
          onChange={(cookiesFile) => onChange({ cookiesFile })}
          onBrowse={onPickCookieFile}
        />
      </FieldRow>
    </Stack>
  );
}
