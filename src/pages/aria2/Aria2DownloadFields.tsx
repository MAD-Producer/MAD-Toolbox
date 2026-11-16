import { useId } from "react";
import { File as FileIcon, X } from "@phosphor-icons/react";
import { CookieFileField } from "../../components/common/CookieFileField";
import { FieldRow } from "../../components/common/FieldRow";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Segmented } from "../../components/ui/segmented";
import { Textarea } from "../../components/ui/textarea";
import { resolveDefaultOutputDirectory } from "../../lib/platform";
import { t, type TranslationKey } from "../../locale";
import type { CookieFileOption } from "../../contracts/types";
import type { Aria2FormState, Aria2SourceKind } from "./form";

const SOURCE_OPTIONS: ReadonlyArray<{ value: Aria2SourceKind; labelKey: TranslationKey }> = [
  { value: "uri", labelKey: "aria2.source.uri" },
  { value: "torrent", labelKey: "aria2.source.torrent" }
];

interface Aria2DownloadFieldsProps {
  form: Aria2FormState;
  disabled: boolean;
  onUpdate: (patch: Partial<Aria2FormState>) => void;
  onPickOutputDirectory: () => Promise<void>;
  onPickCookieFile: () => Promise<void>;
  onPickTorrentFile: () => Promise<void>;
  cookieFiles: CookieFileOption[];
  onAddCookieFile?: () => void;
  globalProxy?: string | null;
}

export function Aria2DownloadFields({
  form,
  disabled,
  onUpdate,
  onPickOutputDirectory,
  onPickCookieFile,
  onPickTorrentFile,
  cookieFiles,
  onAddCookieFile,
  globalProxy
}: Aria2DownloadFieldsProps) {
  const sourceId = useId();
  const uriId = useId();
  const torrentId = useId();
  const proxyId = useId();
  const outputId = useId();
  const outputHintId = useId();

  const sourceKind: Aria2SourceKind = form.source;

  return (
    <div className="flex flex-col gap-4">
      <FieldRow
        label={t("aria2.fields.source")}
        hint={t("aria2.fields.sourceHint")}
        htmlFor={sourceId}
      >
        <Segmented
          aria-label={t("aria2.fields.source")}
          options={SOURCE_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
          value={sourceKind}
          onChange={(value) => onUpdate({ source: value })}
          disabled={disabled}
        />
      </FieldRow>

      {sourceKind === "torrent" ? (
        <FieldRow
          label={t("aria2.fields.torrentFile")}
          hint={t("aria2.fields.torrentFileHint")}
          htmlFor={torrentId}
        >
          <div className="flex items-center gap-2">
            <Input
              id={torrentId}
              value={form.torrentFile}
              onChange={(event) => onUpdate({ torrentFile: event.currentTarget.value })}
              placeholder={t("aria2.fields.torrentFilePlaceholder")}
              disabled={disabled}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5"
              leftSection={<FileIcon size={16} />}
              onClick={() => void onPickTorrentFile()}
              disabled={disabled}
            >
              {t("aria2.fields.torrentBrowse")}
            </Button>
            {form.torrentFile ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 shrink-0 gap-1.5"
                leftSection={<X size={16} />}
                onClick={() => onUpdate({ torrentFile: "" })}
                disabled={disabled}
                aria-label={t("aria2.fields.torrentClear")}
              >
                {t("common.clear")}
              </Button>
            ) : null}
          </div>
        </FieldRow>
      ) : (
        <FieldRow label={t("aria2.fields.uri")} htmlFor={uriId}>
          <Textarea
            id={uriId}
            autosize
            rows={2}
            value={form.uri}
            onChange={(event) => onUpdate({ uri: event.currentTarget.value })}
            placeholder={t("aria2.fields.uriPlaceholder")}
            disabled={disabled}
          />
        </FieldRow>
      )}

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

      <FieldRow
        label={t("aria2.fields.proxy")}
        htmlFor={proxyId}
        hint={t("aria2.fields.proxyHint")}
      >
        <Input
          id={proxyId}
          placeholder={globalProxy ?? t("aria2.fields.proxyPlaceholder")}
          value={form.allProxy}
          onChange={(event) => onUpdate({ allProxy: event.currentTarget.value })}
          disabled={disabled}
        />
      </FieldRow>

      <FieldRow label={t("aria2.fields.cookiesFile")} hint={t("aria2.fields.cookiesFileHint")}>
        <CookieFileField
          value={form.cookiesFile}
          options={cookieFiles}
          disabled={disabled}
          onChange={(cookiesFile) => onUpdate({ cookiesFile })}
          onBrowse={onPickCookieFile}
          onAddCookieFile={onAddCookieFile}
        />
      </FieldRow>
    </div>
  );
}
