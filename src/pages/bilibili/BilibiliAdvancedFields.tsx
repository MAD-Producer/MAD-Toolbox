import {
  MultiSelect,
  PasswordInput,
  SegmentedControl,
  Select,
  Stack,
  TextInput
} from "@mantine/core";
import { FieldRow, OptionGroup, SwitchTileGrid } from "../../components/common/FieldRow";
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

const API_OPTIONS: ReadonlyArray<{ value: BilibiliFormState["api"]; label: string }> = [
  { value: "web", label: "Web" },
  { value: "tv", label: "TV" },
  { value: "app", label: "APP" }
];

const QUALITY_OPTIONS: ReadonlyArray<{ value: string; labelKey: TranslationKey }> = [
  { value: "8K 超高清", labelKey: "bilibili.quality.127" },
  { value: "杜比视界", labelKey: "bilibili.quality.126" },
  { value: "HDR 真彩", labelKey: "bilibili.quality.125" },
  { value: "4K 超清", labelKey: "bilibili.quality.120" },
  { value: "1080P 高帧率", labelKey: "bilibili.quality.116" },
  { value: "1080P 高码率", labelKey: "bilibili.quality.112" },
  { value: "1080P 高清", labelKey: "bilibili.quality.80" },
  { value: "720P 高帧率", labelKey: "bilibili.quality.74" },
  { value: "720P 高清", labelKey: "bilibili.quality.64" },
  { value: "480P 清晰", labelKey: "bilibili.quality.32" },
  { value: "360P 流畅", labelKey: "bilibili.quality.16" },
  { value: "240P 流畅", labelKey: "bilibili.quality.6" },
  { value: "144P 流畅", labelKey: "bilibili.quality.5" }
];

function parseQualityPriority(raw: string): string[] {
  return raw
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

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
}: Omit<BilibiliAdvancedFieldsProps, never> & { items: ReadonlyArray<ValueItem> }) {
  return (
    <>
      {items.map(([key, labelKey, placeholder]) => (
        <FieldRow key={key} label={t(labelKey)}>
          <TextInput
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
  return (
    <Stack gap="md">
      <OptionGroup title={t("bilibili.group.content")}>
        <SwitchTileGrid items={toTileItems(CONTENT_SWITCHES, form, onUpdate)} disabled={disabled} />
        <FieldRow label={t("bilibili.fields.mode")}>
          <Select
            data={MODE_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
            value={form.mode}
            onChange={(value) => value && onUpdate({ mode: value as BilibiliFormState["mode"] })}
            disabled={disabled}
            allowDeselect={false}
          />
        </FieldRow>
        <FieldRow label={t("bilibili.fields.api")}>
          <SegmentedControl
            data={[...API_OPTIONS, { value: "intl", label: t("bilibili.api.intl") }]}
            value={form.api}
            onChange={(value) => onUpdate({ api: value as BilibiliFormState["api"] })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow label={t("bilibili.fields.qualityPriority")}>
          <MultiSelect
            data={QUALITY_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
            placeholder={t("bilibili.fields.qualityPriorityPlaceholder")}
            value={parseQualityPriority(form.qualityPriority)}
            onChange={(values) => onUpdate({ qualityPriority: values.join(",") })}
            disabled={disabled}
            searchable
            clearable
          />
        </FieldRow>
        <FieldRow label={t("bilibili.fields.encodingPriority")}>
          <TextInput
            placeholder={t("bilibili.fields.encodingPriorityPlaceholder")}
            value={form.encodingPriority}
            onChange={(event) => onUpdate({ encodingPriority: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
      </OptionGroup>

      <OptionGroup title={t("bilibili.group.credential")}>
        <FieldRow label="Cookie" hint={t("bilibili.advanced.cookieHint")}>
          <PasswordInput
            value={form.cookie}
            onChange={(event) => onUpdate({ cookie: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow label="Access Token" hint={t("bilibili.advanced.accessTokenHint")}>
          <PasswordInput
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
    </Stack>
  );
}
