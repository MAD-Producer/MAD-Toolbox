import { Group, SegmentedControl, Select, Switch, Text, TextInput } from "@mantine/core";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
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

const COMMON_SWITCHES: Array<[keyof BilibiliFormState, TranslationKey]> = [
  ["downloadDanmaku", "bilibili.switch.downloadDanmaku"],
  ["skipSubtitle", "bilibili.switch.skipSubtitle"],
  ["skipCover", "bilibili.switch.skipCover"],
  ["skipAi", "bilibili.switch.skipAi"]
];

interface BilibiliDownloadFieldsProps {
  form: BilibiliFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<BilibiliFormState>) => void;
  onPickOutputDirectory: () => Promise<void>;
}

export function BilibiliDownloadFields({
  form,
  disabled,
  onUpdate,
  onPickOutputDirectory
}: BilibiliDownloadFieldsProps) {
  return (
    <>
      <TextInput
        label={t("bilibili.fields.url")}
        placeholder={t("bilibili.fields.urlPlaceholder")}
        value={form.url}
        onChange={(event) => onUpdate({ url: event.currentTarget.value })}
        disabled={disabled}
      />
      <Group grow align="end">
        <Select
          label={t("bilibili.fields.mode")}
          data={MODE_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
          value={form.mode}
          onChange={(value) => value && onUpdate({ mode: value as BilibiliFormState["mode"] })}
          disabled={disabled}
          allowDeselect={false}
        />
        <div>
          <Text size="sm" fw={500} mb={4}>
            {t("bilibili.fields.api")}
          </Text>
          <SegmentedControl
            data={[...API_OPTIONS, { value: "intl", label: t("bilibili.api.intl") }]}
            value={form.api}
            onChange={(value) => onUpdate({ api: value as BilibiliFormState["api"] })}
            disabled={disabled}
            fullWidth
          />
        </div>
      </Group>
      <Group grow>
        <TextInput
          label={t("bilibili.fields.pages")}
          placeholder={t("bilibili.fields.pagesPlaceholder")}
          value={form.pages}
          onChange={(event) => onUpdate({ pages: event.currentTarget.value })}
          disabled={disabled}
        />
        <TextInput
          label={t("bilibili.fields.qualityPriority")}
          placeholder={t("bilibili.fields.qualityPriorityPlaceholder")}
          value={form.qualityPriority}
          onChange={(event) => onUpdate({ qualityPriority: event.currentTarget.value })}
          disabled={disabled}
        />
        <TextInput
          label={t("bilibili.fields.encodingPriority")}
          placeholder={t("bilibili.fields.encodingPriorityPlaceholder")}
          value={form.encodingPriority}
          onChange={(event) => onUpdate({ encodingPriority: event.currentTarget.value })}
          disabled={disabled}
        />
      </Group>
      <OutputDirectoryField
        value={form.outputDirectory}
        disabled={disabled}
        placeholder={t("bilibili.fields.outputPlaceholder")}
        onChange={(outputDirectory) => onUpdate({ outputDirectory })}
        onBrowse={onPickOutputDirectory}
      />
      <Group gap="lg">
        {COMMON_SWITCHES.map(([key, labelKey]) => (
          <Switch
            key={key}
            label={t(labelKey)}
            checked={form[key] as boolean}
            onChange={(event) => onUpdate({ [key]: event.currentTarget.checked })}
            disabled={disabled}
          />
        ))}
      </Group>
    </>
  );
}
