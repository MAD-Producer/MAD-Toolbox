import { NumberInput, Stack, TextInput } from "@mantine/core";
import { CookieFileField } from "../../components/common/CookieFileField";
import { FieldRow } from "../../components/common/FieldRow";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
import { resolveDefaultOutputDirectory } from "../../lib/platform";
import { t } from "../../locale";
import type { CookieFileOption } from "../../contracts/types";
import { DEFAULT_SEARCH_SIZE, type MusicFormPatch, type MusicFormState } from "./configuration";

interface MusicConfigurationPanelProps {
  form: MusicFormState;
  onChange: (patch: MusicFormPatch) => void;
  onPickOutputDirectory: () => void;
  onPickCookieFile: () => void;
  globalProxy?: string | null;
  defaultOutputDirectory?: string | null;
  cookieFiles: CookieFileOption[];
  onAddCookieFile?: () => void;
}

export function MusicConfigurationPanel({
  form,
  onChange,
  onPickOutputDirectory,
  onPickCookieFile,
  globalProxy,
  defaultOutputDirectory,
  cookieFiles,
  onAddCookieFile
}: MusicConfigurationPanelProps) {
  const isSearch = form.mode === "search";

  return (
    <Stack gap="md">
      <FieldRow
        label={isSearch ? t("music.keyword.label") : t("music.playlistUrl.label")}
        hint={isSearch ? undefined : t("music.playlistUrl.description")}
      >
        <TextInput
          placeholder={
            isSearch ? t("music.keyword.placeholder") : "https://music.163.com/#/playlist?id=..."
          }
          value={isSearch ? form.keyword : form.playlistUrl}
          onChange={(event) =>
            onChange(
              isSearch
                ? { keyword: event.currentTarget.value }
                : { playlistUrl: event.currentTarget.value }
            )
          }
        />
      </FieldRow>
      <FieldRow label={t("music.outputDirectory")} hint={t("common.outputDirectoryHint")}>
        <OutputDirectoryField
          value={form.outputDirectory}
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
          onChange={(value) =>
            onChange({ searchSize: typeof value === "number" ? value : DEFAULT_SEARCH_SIZE })
          }
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
          options={cookieFiles}
          onBrowse={onPickCookieFile}
          onAddCookieFile={onAddCookieFile}
        />
      </FieldRow>
    </Stack>
  );
}
