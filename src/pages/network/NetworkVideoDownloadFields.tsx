import { Select, Stack, TextInput } from "@mantine/core";
import { FieldRow } from "../../components/common/FieldRow";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
import { browserCookieOptions, resolveDefaultOutputDirectory } from "../../lib/platform";
import { t } from "../../locale";
import type { NetworkFormState } from "./form";

interface NetworkVideoDownloadFieldsProps {
  form: NetworkFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<NetworkFormState>) => void;
  onPickOutputDirectory: () => Promise<void>;
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
    <Stack gap="md">
      <FieldRow label={t("network.fields.url")}>
        <TextInput
          placeholder={t("network.fields.urlPlaceholder")}
          value={form.url}
          onChange={(event) => onUpdate({ url: event.currentTarget.value })}
          disabled={disabled}
        />
      </FieldRow>
      <FieldRow
        label={t("network.fields.cookiesBrowser")}
        hint={t("network.fields.cookiesBrowserHint")}
      >
        <Select
          data={browserCookieOptions()}
          value={form.cookiesBrowser}
          onChange={(value) => onUpdate({ cookiesBrowser: value ?? "" })}
          disabled={disabled}
          allowDeselect={false}
        />
      </FieldRow>
      <FieldRow label={t("common.outputDirectory")} hint={t("common.outputDirectoryHint")}>
        <OutputDirectoryField
          bare
          value={form.outputDirectory}
          disabled={disabled}
          onChange={(outputDirectory) => onUpdate({ outputDirectory })}
          onBrowse={onPickOutputDirectory}
          resolveDefault={resolveDefaultOutputDirectory}
        />
      </FieldRow>
      <FieldRow label={t("network.fields.proxy")}>
        <TextInput
          placeholder={globalProxy ?? t("network.fields.proxyPlaceholder")}
          value={form.proxy}
          onChange={(event) => onUpdate({ proxy: event.currentTarget.value })}
          disabled={disabled}
        />
      </FieldRow>
      <FieldRow label={t("network.fields.playlistItems")}>
        <TextInput
          placeholder={t("network.fields.playlistItemsPlaceholder")}
          value={form.playlistItems}
          onChange={(event) => onUpdate({ playlistItems: event.currentTarget.value })}
          disabled={disabled}
        />
      </FieldRow>
    </Stack>
  );
}
