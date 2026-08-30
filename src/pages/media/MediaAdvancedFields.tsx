import { NumberInput, Select, Stack, TextInput } from "@mantine/core";
import {
  FieldRow,
  OptionGroup,
  SwitchTileGrid,
  type SwitchTileItem
} from "../../components/common/FieldRow";
import { t, type TranslationKey } from "../../locale";
import type { MediaFormState } from "./form";

// 高级开关按分类拆组；faststart 沿用 ffmpeg 参数原名字面量，不设翻译键
type AdvancedSwitch = {
  key: keyof MediaFormState;
  labelKey?: TranslationKey;
  label?: string;
};

const VIDEO_SWITCHES: ReadonlyArray<AdvancedSwitch> = [
  { key: "deinterlace", labelKey: "media.fields.deinterlace" },
  { key: "flipHorizontal", labelKey: "media.fields.flipHorizontal" },
  { key: "flipVertical", labelKey: "media.fields.flipVertical" }
];

const ENCODING_SWITCHES: ReadonlyArray<AdvancedSwitch> = [{ key: "fastStart", label: "faststart" }];

const AUDIO_SWITCHES: ReadonlyArray<AdvancedSwitch> = [
  { key: "loudnessNormalization", labelKey: "media.fields.loudnessNormalization" }
];

function toTileItems(
  switches: ReadonlyArray<AdvancedSwitch>,
  form: MediaFormState,
  onUpdate: (patch: Partial<MediaFormState>) => void
): SwitchTileItem[] {
  return switches.map(({ key, labelKey, label }) => ({
    key,
    label: labelKey ? t(labelKey) : (label as string),
    checked: form[key] as boolean,
    onToggle: (checked) => onUpdate({ [key]: checked })
  }));
}

interface MediaAdvancedFieldsProps {
  form: MediaFormState;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaAdvancedFields({ form, onUpdate }: MediaAdvancedFieldsProps) {
  return (
    <Stack gap="md">
      <OptionGroup title={t("media.group.video")}>
        <FieldRow label={t("media.fields.scaleWidth")}>
          <TextInput
            placeholder={t("media.fields.keepEmpty")}
            value={form.width}
            onChange={(event) => onUpdate({ width: event.currentTarget.value })}
          />
        </FieldRow>
        <FieldRow label={t("media.fields.scaleHeight")}>
          <TextInput
            placeholder={t("media.fields.keepEmpty")}
            value={form.height}
            onChange={(event) => onUpdate({ height: event.currentTarget.value })}
          />
        </FieldRow>
        <FieldRow label={t("media.fields.frameRate")}>
          <TextInput
            value={form.frameRate}
            onChange={(event) => onUpdate({ frameRate: event.currentTarget.value })}
          />
        </FieldRow>
        <FieldRow label={t("media.fields.speed")}>
          <NumberInput
            step={0.25}
            min={0.25}
            value={form.speed}
            onChange={(value) => onUpdate({ speed: typeof value === "number" ? value : 1 })}
          />
        </FieldRow>
        <FieldRow label={t("media.fields.rotation")}>
          <Select
            data={[
              { value: "none", label: t("media.rotation.none") },
              { value: "90cw", label: t("media.rotation.90cw") },
              { value: "90ccw", label: t("media.rotation.90ccw") },
              { value: "180", label: "180°" }
            ]}
            value={form.rotation}
            onChange={(value) => value && onUpdate({ rotation: value })}
            allowDeselect={false}
          />
        </FieldRow>
        <FieldRow label={t("media.fields.crop")}>
          <TextInput
            placeholder={t("media.fields.cropHint")}
            value={form.crop}
            onChange={(event) => onUpdate({ crop: event.currentTarget.value })}
          />
        </FieldRow>
        <SwitchTileGrid items={toTileItems(VIDEO_SWITCHES, form, onUpdate)} columns={3} />
      </OptionGroup>
      <OptionGroup title={t("media.group.encoding")}>
        <FieldRow label={t("media.fields.videoBitrate")}>
          <TextInput
            placeholder={t("media.fields.videoBitrateHint")}
            value={form.videoBitrate}
            onChange={(event) => onUpdate({ videoBitrate: event.currentTarget.value })}
          />
        </FieldRow>
        <FieldRow label="CRF">
          <TextInput
            value={form.crf}
            onChange={(event) => onUpdate({ crf: event.currentTarget.value })}
          />
        </FieldRow>
        <SwitchTileGrid items={toTileItems(ENCODING_SWITCHES, form, onUpdate)} columns={3} />
      </OptionGroup>
      <OptionGroup title={t("media.group.audio")}>
        <FieldRow label={t("media.fields.audioBitrate")}>
          <TextInput
            value={form.audioBitrate}
            onChange={(event) => onUpdate({ audioBitrate: event.currentTarget.value })}
          />
        </FieldRow>
        <FieldRow label={t("media.fields.sampleRate")}>
          <TextInput
            placeholder={t("media.fields.sampleRateHint")}
            value={form.sampleRate}
            onChange={(event) => onUpdate({ sampleRate: event.currentTarget.value })}
          />
        </FieldRow>
        <FieldRow label={t("media.fields.volume")}>
          <TextInput
            placeholder={t("media.fields.volumeHint")}
            value={form.volume}
            onChange={(event) => onUpdate({ volume: event.currentTarget.value })}
          />
        </FieldRow>
        <SwitchTileGrid items={toTileItems(AUDIO_SWITCHES, form, onUpdate)} columns={3} />
      </OptionGroup>
    </Stack>
  );
}
