import { useId } from "react";
import { FieldRow, OptionGroup, SwitchTileGrid } from "../../components/common/FieldRow";
import { Input } from "../../components/ui/input";
import { PasswordInput } from "../../components/ui/password-input";
import { Segmented } from "../../components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { t, type TranslationKey } from "../../locale";
import type { BilibiliFormState } from "./form";

const MODE_OPTIONS: ReadonlyArray<{ value: BilibiliFormState["mode"]; labelKey: TranslationKey }> =
  [
    { value: "video", labelKey: "bilibili.mode.video" },
    { value: "video-only", labelKey: "bilibili.mode.videoOnly" },
    { value: "audio", labelKey: "bilibili.mode.audio" },
    { value: "cover", labelKey: "bilibili.mode.cover" },
    { value: "subtitle", labelKey: "bilibili.mode.subtitle" },
    { value: "danmaku", labelKey: "bilibili.mode.danmaku" },
    { value: "info", labelKey: "bilibili.mode.info" }
  ];

const API_OPTIONS: ReadonlyArray<{
  value: BilibiliFormState["api"];
  labelKey?: TranslationKey;
  label?: string;
}> = [
  { value: "web", label: "Web" },
  { value: "tv", label: "TV" },
  { value: "app", label: "APP" },
  { value: "intl", labelKey: "bilibili.api.intl" }
];

type SwitchItem = [keyof BilibiliFormState, TranslationKey];
type ValueItem = [keyof BilibiliFormState, TranslationKey, string];

const CONTENT_SWITCHES: ReadonlyArray<SwitchItem> = [
  ["downloadDanmaku", "bilibili.switch.downloadDanmaku"],
  ["skipSubtitle", "bilibili.switch.skipSubtitle"],
  ["skipCover", "bilibili.switch.skipCover"],
  ["skipAi", "bilibili.switch.skipAi"]
];

const ENGINE_SWITCHES: ReadonlyArray<SwitchItem> = [
  ["useMp4box", "bilibili.advanced.useMp4box"],
  ["useAria2c", "bilibili.advanced.useAria2c"],
  ["skipMux", "bilibili.advanced.skipMux"],
  ["multiThread", "bilibili.advanced.multiThread"],
  ["debug", "bilibili.advanced.debug"]
];

const ENGINE_VALUES: ReadonlyArray<ValueItem> = [
  ["mp4boxPath", "bilibili.advanced.mp4boxPath", ""],
  ["aria2cPath", "bilibili.advanced.aria2cPath", ""],
  ["aria2cArgs", "bilibili.advanced.aria2cArgs", ""]
];

const NETWORK_SWITCHES: ReadonlyArray<SwitchItem> = [
  ["forceHttp", "bilibili.advanced.forceHttp"],
  ["allowPcdn", "bilibili.advanced.allowPcdn"],
  ["forceReplaceHost", "bilibili.advanced.forceReplaceHost"]
];

const NETWORK_VALUES: ReadonlyArray<ValueItem> = [
  ["userAgent", "bilibili.advanced.userAgent", ""],
  ["uposHost", "bilibili.advanced.uposHost", ""],
  ["host", "bilibili.advanced.host", ""],
  ["epHost", "bilibili.advanced.epHost", ""],
  ["area", "bilibili.advanced.area", "hk / tw / th"],
  ["delayPerPage", "bilibili.advanced.delayPerPage", ""]
];

const OUTPUT_SWITCHES: ReadonlyArray<SwitchItem> = [
  ["videoAscending", "bilibili.advanced.videoAscending"],
  ["audioAscending", "bilibili.advanced.audioAscending"],
  ["showAll", "bilibili.advanced.showAll"],
  ["hideStreams", "bilibili.advanced.hideStreams"],
  ["saveArchive", "bilibili.advanced.saveArchive"]
];

const OUTPUT_VALUES: ReadonlyArray<ValueItem> = [
  ["language", "bilibili.advanced.language", ""],
  ["filePattern", "bilibili.advanced.filePattern", ""],
  ["multiFilePattern", "bilibili.advanced.multiFilePattern", ""],
  ["configFile", "bilibili.advanced.configFile", ""]
];

interface BilibiliAdvancedFieldsProps {
  form: BilibiliFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<BilibiliFormState>) => void;
}

function toTileItems(
  items: ReadonlyArray<SwitchItem>,
  form: BilibiliFormState,
  onUpdate: BilibiliAdvancedFieldsProps["onUpdate"]
) {
  return items.map(([key, labelKey]) => ({
    key,
    label: t(labelKey),
    checked: form[key] as boolean,
    onToggle: (checked: boolean) => onUpdate({ [key]: checked })
  }));
}

function ValueRows({
  form,
  items,
  disabled,
  onUpdate
}: BilibiliAdvancedFieldsProps & { items: ReadonlyArray<ValueItem> }) {
  const baseId = useId();
  return (
    <>
      {items.map(([key, labelKey, placeholder]) => (
        <FieldRow key={key} label={t(labelKey)} htmlFor={`${baseId}-${key}`}>
          <Input
            id={`${baseId}-${key}`}
            placeholder={placeholder}
            value={form[key] as string}
            onChange={(event) => onUpdate({ [key]: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
      ))}
    </>
  );
}

export function BilibiliAdvancedFields({ form, disabled, onUpdate }: BilibiliAdvancedFieldsProps) {
  const modeLabelId = useId();
  const qualityId = useId();
  const qualityHintId = useId();
  const encodingId = useId();
  const cookieId = useId();
  const cookieHintId = useId();
  const accessTokenId = useId();
  const accessTokenHintId = useId();

  return (
    <div className="flex flex-col gap-4">
      <OptionGroup title={t("bilibili.group.content")}>
        <SwitchTileGrid items={toTileItems(CONTENT_SWITCHES, form, onUpdate)} disabled={disabled} />
        <FieldRow label={t("bilibili.fields.mode")} htmlFor={modeLabelId}>
          <Select
            value={form.mode}
            onValueChange={(value) => onUpdate({ mode: value as BilibiliFormState["mode"] })}
            disabled={disabled}
          >
            <SelectTrigger id={modeLabelId} aria-label={t("bilibili.fields.mode")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map(({ value, labelKey }) => (
                <SelectItem key={value} value={value}>
                  {t(labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label={t("bilibili.fields.api")}>
          <Segmented
            aria-label={t("bilibili.fields.api")}
            options={API_OPTIONS.map(({ value, labelKey, label }) => ({
              value,
              label: labelKey ? t(labelKey) : (label as string)
            }))}
            value={form.api}
            onChange={(value) => onUpdate({ api: value })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow
          label={t("bilibili.fields.qualityPriority")}
          hint={t("bilibili.fields.qualityPriorityPlaceholder")}
          htmlFor={qualityId}
          hintId={qualityHintId}
        >
          <Input
            id={qualityId}
            aria-describedby={qualityHintId}
            placeholder={t("bilibili.fields.qualityPriorityExample")}
            value={form.qualityPriority}
            onChange={(event) => onUpdate({ qualityPriority: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow label={t("bilibili.fields.encodingPriority")} htmlFor={encodingId}>
          <Input
            id={encodingId}
            placeholder={t("bilibili.fields.encodingPriorityPlaceholder")}
            value={form.encodingPriority}
            onChange={(event) => onUpdate({ encodingPriority: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
      </OptionGroup>

      <OptionGroup title={t("bilibili.group.credential")}>
        <FieldRow
          label="Cookie"
          hint={t("bilibili.advanced.cookieHint")}
          htmlFor={cookieId}
          hintId={cookieHintId}
        >
          <PasswordInput
            id={cookieId}
            aria-describedby={cookieHintId}
            value={form.cookie}
            onChange={(event) => onUpdate({ cookie: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow
          label="Access Token"
          hint={t("bilibili.advanced.accessTokenHint")}
          htmlFor={accessTokenId}
          hintId={accessTokenHintId}
        >
          <PasswordInput
            id={accessTokenId}
            aria-describedby={accessTokenHintId}
            value={form.accessToken}
            onChange={(event) => onUpdate({ accessToken: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
      </OptionGroup>

      <OptionGroup title={t("bilibili.group.engine")}>
        <SwitchTileGrid items={toTileItems(ENGINE_SWITCHES, form, onUpdate)} disabled={disabled} />
        <ValueRows form={form} items={ENGINE_VALUES} disabled={disabled} onUpdate={onUpdate} />
      </OptionGroup>

      <OptionGroup title={t("bilibili.group.network")}>
        <SwitchTileGrid items={toTileItems(NETWORK_SWITCHES, form, onUpdate)} disabled={disabled} />
        <ValueRows form={form} items={NETWORK_VALUES} disabled={disabled} onUpdate={onUpdate} />
      </OptionGroup>

      <OptionGroup title={t("bilibili.group.output")}>
        <SwitchTileGrid items={toTileItems(OUTPUT_SWITCHES, form, onUpdate)} disabled={disabled} />
        <ValueRows form={form} items={OUTPUT_VALUES} disabled={disabled} onUpdate={onUpdate} />
      </OptionGroup>
    </div>
  );
}
