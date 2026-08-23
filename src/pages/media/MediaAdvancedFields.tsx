import { Group, NumberInput, Select, Stack, Switch, TextInput } from "@mantine/core";
import { t } from "../../locale";
import type { MediaFormState } from "./form";

interface MediaAdvancedFieldsProps {
  form: MediaFormState;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaAdvancedFields({ form, onUpdate }: MediaAdvancedFieldsProps) {
  return (
    <Stack gap="sm">
      <Group grow>
        <TextInput
          label={t("media.fields.scaleWidth")}
          placeholder={t("media.fields.keepEmpty")}
          value={form.width}
          onChange={(event) => onUpdate({ width: event.currentTarget.value })}
        />
        <TextInput
          label={t("media.fields.scaleHeight")}
          placeholder={t("media.fields.keepEmpty")}
          value={form.height}
          onChange={(event) => onUpdate({ height: event.currentTarget.value })}
        />
        <TextInput
          label={t("media.fields.frameRate")}
          value={form.frameRate}
          onChange={(event) => onUpdate({ frameRate: event.currentTarget.value })}
        />
        <NumberInput
          label={t("media.fields.speed")}
          step={0.25}
          min={0.25}
          value={form.speed}
          onChange={(value) => onUpdate({ speed: typeof value === "number" ? value : 1 })}
        />
      </Group>
      <Group grow>
        <TextInput
          label={t("media.fields.videoBitrate")}
          placeholder={t("media.fields.videoBitrateHint")}
          value={form.videoBitrate}
          onChange={(event) => onUpdate({ videoBitrate: event.currentTarget.value })}
        />
        <TextInput
          label="CRF"
          value={form.crf}
          onChange={(event) => onUpdate({ crf: event.currentTarget.value })}
        />
        <TextInput
          label={t("media.fields.audioBitrate")}
          value={form.audioBitrate}
          onChange={(event) => onUpdate({ audioBitrate: event.currentTarget.value })}
        />
        <TextInput
          label={t("media.fields.sampleRate")}
          placeholder={t("media.fields.sampleRateHint")}
          value={form.sampleRate}
          onChange={(event) => onUpdate({ sampleRate: event.currentTarget.value })}
        />
      </Group>
      <Group grow align="end">
        <Select
          label={t("media.fields.rotation")}
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
        <TextInput
          label={t("media.fields.crop")}
          placeholder={t("media.fields.cropHint")}
          value={form.crop}
          onChange={(event) => onUpdate({ crop: event.currentTarget.value })}
        />
        <TextInput
          label={t("media.fields.volume")}
          placeholder={t("media.fields.volumeHint")}
          value={form.volume}
          onChange={(event) => onUpdate({ volume: event.currentTarget.value })}
        />
      </Group>
      <Group gap="lg">
        <Switch
          label={t("media.fields.deinterlace")}
          checked={form.deinterlace}
          onChange={(event) => onUpdate({ deinterlace: event.currentTarget.checked })}
        />
        <Switch
          label={t("media.fields.flipHorizontal")}
          checked={form.flipHorizontal}
          onChange={(event) => onUpdate({ flipHorizontal: event.currentTarget.checked })}
        />
        <Switch
          label={t("media.fields.flipVertical")}
          checked={form.flipVertical}
          onChange={(event) => onUpdate({ flipVertical: event.currentTarget.checked })}
        />
        <Switch
          label={t("media.fields.loudnessNormalization")}
          checked={form.loudnessNormalization}
          onChange={(event) => onUpdate({ loudnessNormalization: event.currentTarget.checked })}
        />
        <Switch
          label="faststart"
          checked={form.fastStart}
          onChange={(event) => onUpdate({ fastStart: event.currentTarget.checked })}
        />
      </Group>
    </Stack>
  );
}
