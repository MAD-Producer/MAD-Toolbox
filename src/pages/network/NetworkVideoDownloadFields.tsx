import { useId } from "react";
import { CookieFileField } from "../../components/common/CookieFileField";
import { FieldRow } from "../../components/common/FieldRow";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
import { Input } from "../../components/ui/input";
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
  const urlId = useId();
  const proxyId = useId();
  const playlistId = useId();
  const outputId = useId();
  const outputHintId = useId();

  return (
    <div className="flex flex-col gap-4">
      <FieldRow label={t("network.fields.url")} htmlFor={urlId}>
        <Input
          id={urlId}
          placeholder={t("network.fields.urlPlaceholder")}
          value={form.url}
          onChange={(event) => onUpdate({ url: event.currentTarget.value })}
          disabled={disabled}
        />
      </FieldRow>
      <FieldRow
        label={t("network.fields.cookiesFile")}
        hint={t("network.fields.cookiesFileHint")}
      >
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
      <FieldRow
        label={t("common.outputDirectory")}
        hint={t("common.outputDirectoryHint")}
        htmlFor={outputId}
        hintId={outputHintId}
      >
        <OutputDirectoryField
          inputId={outputId}
          describedById={outputHintId}
          value={form.outputDirectory}
          disabled={disabled}
          onChange={(outputDirectory) => onUpdate({ outputDirectory })}
          onBrowse={onPickOutputDirectory}
          resolveDefault={resolveDefaultOutputDirectory}
        />
      </FieldRow>
      <FieldRow label={t("network.fields.proxy")} htmlFor={proxyId}>
        <Input
          id={proxyId}
          placeholder={globalProxy ?? t("network.fields.proxyPlaceholder")}
          value={form.proxy}
          onChange={(event) => onUpdate({ proxy: event.currentTarget.value })}
          disabled={disabled}
        />
      </FieldRow>
      <FieldRow label={t("network.fields.playlistItems")} htmlFor={playlistId}>
        <Input
          id={playlistId}
          placeholder={t("network.fields.playlistItemsPlaceholder")}
          value={form.playlistItems}
          onChange={(event) => onUpdate({ playlistItems: event.currentTarget.value })}
          disabled={disabled}
        />
      </FieldRow>
    </div>
  );
}
