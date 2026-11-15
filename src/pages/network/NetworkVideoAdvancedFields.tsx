import { useId } from "react";
import { FieldRow, OptionGroup, SwitchTileGrid } from "../../components/common/FieldRow";
import { Input } from "../../components/ui/input";
import { NumberField } from "../../components/ui/number-field";
import { Segmented } from "../../components/ui/segmented";
import { t, type TranslationKey } from "../../locale";
import { defaultNetworkForm, type NetworkFormState } from "./form";

const MODE_OPTIONS: ReadonlyArray<{ value: NetworkFormState["mode"]; labelKey: TranslationKey }> = [
  { value: "video", labelKey: "network.mode.video" },
  { value: "audio", labelKey: "network.mode.audio" },
  { value: "thumbnail", labelKey: "network.mode.thumbnail" },
  { value: "subtitles", labelKey: "network.mode.subtitles" }
];

const CONTENT_SWITCHES: ReadonlyArray<[keyof NetworkFormState, TranslationKey]> = [
  ["noPlaylist", "network.fields.noPlaylist"],
  ["embedMetadata", "network.fields.embedMetadata"],
  ["embedThumbnail", "network.fields.embedThumbnail"],
  ["embedSubtitles", "network.fields.embedSubtitles"]
];

const DIAGNOSTIC_SWITCHES: ReadonlyArray<[keyof NetworkFormState, TranslationKey]> = [
  ["writeInfoJson", "network.fields.writeInfoJson"],
  ["verbose", "network.fields.verbose"]
];

interface NetworkVideoAdvancedFieldsProps {
  form: NetworkFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<NetworkFormState>) => void;
}

function toTileItems(
  items: ReadonlyArray<[keyof NetworkFormState, TranslationKey]>,
  form: NetworkFormState,
  onUpdate: NetworkVideoAdvancedFieldsProps["onUpdate"]
) {
  return items.map(([key, labelKey]) => ({
    key,
    label: t(labelKey),
    checked: form[key] as boolean,
    onToggle: (checked: boolean) => onUpdate({ [key]: checked })
  }));
}

export function NetworkVideoAdvancedFields({
  form,
  disabled,
  onUpdate
}: NetworkVideoAdvancedFieldsProps) {
  const audioFormatId = useId();
  const subtitleLanguagesId = useId();
  const formatId = useId();
  const outputTemplateId = useId();
  const retriesId = useId();
  const concurrentFragmentsId = useId();

  return (
    <div className="flex flex-col gap-4">
      <OptionGroup title={t("network.group.content")}>
        <FieldRow label={t("network.fields.content")}>
          <Segmented
            aria-label={t("network.fields.content")}
            options={MODE_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
            value={form.mode}
            onChange={(value) => onUpdate({ mode: value })}
            disabled={disabled}
          />
        </FieldRow>
        {form.mode === "audio" && (
          <FieldRow label={t("network.fields.audioFormat")} htmlFor={audioFormatId}>
            <Input
              id={audioFormatId}
              placeholder="best / mp3 / m4a / flac …"
              value={form.audioFormat}
              onChange={(event) => onUpdate({ audioFormat: event.currentTarget.value })}
              disabled={disabled}
            />
          </FieldRow>
        )}
        {form.mode === "subtitles" && (
          <FieldRow label={t("network.fields.subtitleLanguages")} htmlFor={subtitleLanguagesId}>
            <Input
              id={subtitleLanguagesId}
              placeholder={t("network.fields.subtitleLanguagesPlaceholder")}
              value={form.subtitleLanguages}
              onChange={(event) => onUpdate({ subtitleLanguages: event.currentTarget.value })}
              disabled={disabled}
            />
          </FieldRow>
        )}
        <SwitchTileGrid items={toTileItems(CONTENT_SWITCHES, form, onUpdate)} disabled={disabled} />
      </OptionGroup>

      <OptionGroup title={t("network.group.format")}>
        <FieldRow label={t("network.fields.format")} htmlFor={formatId}>
          <Input
            id={formatId}
            placeholder={t("network.fields.formatPlaceholder")}
            value={form.format}
            onChange={(event) => onUpdate({ format: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow label={t("network.fields.outputTemplate")} htmlFor={outputTemplateId}>
          <Input
            id={outputTemplateId}
            value={form.outputTemplate}
            onChange={(event) => onUpdate({ outputTemplate: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
      </OptionGroup>

      <OptionGroup title={t("network.group.network")}>
        <FieldRow label={t("network.fields.retries")} htmlFor={retriesId}>
          <NumberField
            id={retriesId}
            min={0}
            value={form.retries}
            onChange={(value) => onUpdate({ retries: value ?? defaultNetworkForm.retries })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow label={t("network.fields.concurrentFragments")} htmlFor={concurrentFragmentsId}>
          <NumberField
            id={concurrentFragmentsId}
            min={1}
            value={form.concurrentFragments}
            onChange={(value) =>
              onUpdate({ concurrentFragments: value ?? defaultNetworkForm.concurrentFragments })
            }
            disabled={disabled}
          />
        </FieldRow>
      </OptionGroup>

      <OptionGroup title={t("network.group.diagnostics")}>
        <SwitchTileGrid
          items={toTileItems(DIAGNOSTIC_SWITCHES, form, onUpdate)}
          disabled={disabled}
        />
      </OptionGroup>
    </div>
  );
}
