import { Group, SegmentedControl, Select, Switch, Text, TextInput } from "@mantine/core";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
import { browserCookieOptions } from "../../lib/platform";
import { t, type TranslationKey } from "../../locale";
import type { NetworkFormState } from "./form";

const MODE_OPTIONS: ReadonlyArray<{ value: NetworkFormState["mode"]; labelKey: TranslationKey }> = [
  { value: "video", labelKey: "network.mode.video" },
  { value: "audio", labelKey: "network.mode.audio" },
  { value: "thumbnail", labelKey: "network.mode.thumbnail" },
  { value: "subtitles", labelKey: "network.mode.subtitles" }
];

interface NetworkVideoDownloadFieldsProps {
  form: NetworkFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<NetworkFormState>) => void;
  onPickOutputDirectory: () => Promise<void>;
  /** 设置页的全局代理；已设置时作为占位提示，留空提交即使用它 */
  globalProxy?: string | null;
}

export function NetworkVideoDownloadFields({
  form,
  disabled,
  onUpdate,
  onPickOutputDirectory,
  globalProxy
}: NetworkVideoDownloadFieldsProps) {
  return (
    <>
      <TextInput
        label={t("network.fields.url")}
        placeholder={t("network.fields.urlPlaceholder")}
        value={form.url}
        onChange={(event) => onUpdate({ url: event.currentTarget.value })}
        disabled={disabled}
      />
      <Group grow align="end">
        <div>
          <Text size="sm" fw={500} mb={4}>
            {t("network.fields.content")}
          </Text>
          <SegmentedControl
            data={MODE_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
            value={form.mode}
            onChange={(value) => onUpdate({ mode: value as NetworkFormState["mode"] })}
            disabled={disabled}
            fullWidth
          />
        </div>
        <Select
          label={t("network.fields.cookiesBrowser")}
          data={browserCookieOptions()}
          value={form.cookiesBrowser}
          onChange={(value) => onUpdate({ cookiesBrowser: value ?? "" })}
          disabled={disabled}
          allowDeselect={false}
        />
      </Group>
      {form.mode === "audio" && (
        <TextInput
          label={t("network.fields.audioFormat")}
          placeholder="best / mp3 / m4a / flac …"
          value={form.audioFormat}
          onChange={(event) => onUpdate({ audioFormat: event.currentTarget.value })}
          disabled={disabled}
        />
      )}
      {form.mode === "subtitles" && (
        <TextInput
          label={t("network.fields.subtitleLanguages")}
          placeholder={t("network.fields.subtitleLanguagesPlaceholder")}
          value={form.subtitleLanguages}
          onChange={(event) => onUpdate({ subtitleLanguages: event.currentTarget.value })}
          disabled={disabled}
        />
      )}
      <OutputDirectoryField
        value={form.outputDirectory}
        disabled={disabled}
        onChange={(outputDirectory) => onUpdate({ outputDirectory })}
        onBrowse={onPickOutputDirectory}
      />
      <Group grow>
        <TextInput
          label={t("network.fields.proxy")}
          placeholder={globalProxy ?? t("network.fields.proxyPlaceholder")}
          value={form.proxy}
          onChange={(event) => onUpdate({ proxy: event.currentTarget.value })}
          disabled={disabled}
        />
        <TextInput
          label={t("network.fields.playlistItems")}
          placeholder={t("network.fields.playlistItemsPlaceholder")}
          value={form.playlistItems}
          onChange={(event) => onUpdate({ playlistItems: event.currentTarget.value })}
          disabled={disabled}
        />
      </Group>
      <Group gap="lg">
        <Switch
          label={t("network.fields.noPlaylist")}
          checked={form.noPlaylist}
          onChange={(event) => onUpdate({ noPlaylist: event.currentTarget.checked })}
          disabled={disabled}
        />
        <Switch
          label={t("network.fields.embedMetadata")}
          checked={form.embedMetadata}
          onChange={(event) => onUpdate({ embedMetadata: event.currentTarget.checked })}
          disabled={disabled}
        />
        <Switch
          label={t("network.fields.embedThumbnail")}
          checked={form.embedThumbnail}
          onChange={(event) => onUpdate({ embedThumbnail: event.currentTarget.checked })}
          disabled={disabled}
        />
        <Switch
          label={t("network.fields.embedSubtitles")}
          checked={form.embedSubtitles}
          onChange={(event) => onUpdate({ embedSubtitles: event.currentTarget.checked })}
          disabled={disabled}
        />
      </Group>
    </>
  );
}
