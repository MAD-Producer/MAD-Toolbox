import { Stack, TextInput } from "@mantine/core";
import { CookieFileField } from "../../components/common/CookieFileField";
import { FieldRow } from "../../components/common/FieldRow";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
import { resolveDefaultOutputDirectory } from "../../lib/platform";
import { t } from "../../locale";
import type { CookieFileOption } from "../../contracts/types";
import type { CookieVerificationStatus } from "../../components/common/CookieFileField";
import type { NetworkFormState } from "./form";

interface NetworkVideoDownloadFieldsProps {
  form: NetworkFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<NetworkFormState>) => void;
  onPickOutputDirectory: () => Promise<void>;
  onPickCookieFile: () => Promise<void>;
  onVerifyCookie: () => Promise<void>;
  cookieFiles: CookieFileOption[];
  cookieVerification: CookieVerificationStatus;
  verifyingCookie: boolean;
  onAddCookieFile?: () => void;
  globalProxy?: string | null;
}

export function NetworkVideoDownloadFields({
  form,
  disabled,
  onUpdate,
  onPickOutputDirectory,
  onPickCookieFile,
  onVerifyCookie,
  cookieFiles,
  cookieVerification,
  verifyingCookie,
  onAddCookieFile,
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
      <FieldRow label={t("network.fields.cookiesFile")} hint={t("network.fields.cookiesFileHint")}>
        <CookieFileField
          value={form.cookiesFile}
          options={cookieFiles}
          disabled={disabled}
          verificationStatus={cookieVerification}
          verifying={verifyingCookie}
          onChange={(cookiesFile) => onUpdate({ cookiesFile })}
          onBrowse={onPickCookieFile}
          onVerify={onVerifyCookie}
          onAddCookieFile={onAddCookieFile}
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
