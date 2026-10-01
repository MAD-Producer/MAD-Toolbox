import { NumberInput, Select, Stack, TextInput } from "@mantine/core";
import { FieldRow, OptionGroup, SwitchTileGrid } from "../../components/common/FieldRow";
import { t } from "../../locale";
import { defaultMediaForm, type MediaFormState } from "./form";
import { mediaSwitchTileItems, type MediaSwitchSpec } from "./switchTiles";

const VIDEO_SWITCHES: ReadonlyArray<MediaSwitchSpec> = [
  { key: "deinterlace", labelKey: "media.fields.deinterlace" },
  { key: "flipHorizontal", labelKey: "media.fields.flipHorizontal" },
  { key: "flipVertical", labelKey: "media.fields.flipVertical" }
];

const ENCODING_SWITCHES: ReadonlyArray<MediaSwitchSpec> = [
  { key: "fastStart", label: "faststart" }
];

const AUDIO_SWITCHES: ReadonlyArray<MediaSwitchSpec> = [
  { key: "loudnessNormalization", labelKey: "media.fields.loudnessNormalization" }
];

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
            onChange={(value) =>
              onUpdate({ speed: typeof value === "number" ? value : defaultMediaForm.speed })
            }
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
        <SwitchTileGrid items={mediaSwitchTileItems(VIDEO_SWITCHES, form, onUpdate)} columns={3} />
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
        <SwitchTileGrid
          items={mediaSwitchTileItems(ENCODING_SWITCHES, form, onUpdate)}
          columns={3}
        />
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
        <SwitchTileGrid items={mediaSwitchTileItems(AUDIO_SWITCHES, form, onUpdate)} columns={3} />
      </OptionGroup>
    </Stack>
  );
}
