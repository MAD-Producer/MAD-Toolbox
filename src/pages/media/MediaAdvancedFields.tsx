import { useId } from "react";
import { FieldRow, OptionGroup, SwitchTileGrid } from "../../components/common/FieldRow";
import { Input } from "../../components/ui/input";
import { NumberField } from "../../components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../../components/ui/select";
import { t, type TranslationKey } from "../../locale";
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

const ROTATION_OPTIONS: ReadonlyArray<{
  value: MediaFormState["rotation"];
  labelKey: TranslationKey | null;
  label?: string;
}> = [
  { value: "none", labelKey: "media.rotation.none" },
  { value: "90cw", labelKey: "media.rotation.90cw" },
  { value: "90ccw", labelKey: "media.rotation.90ccw" },
  { value: "180", labelKey: null, label: "180°" }
];

interface MediaAdvancedFieldsProps {
  form: MediaFormState;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaAdvancedFields({ form, onUpdate }: MediaAdvancedFieldsProps) {
  const scaleWidthId = useId();
  const scaleHeightId = useId();
  const frameRateId = useId();
  const speedId = useId();
  const rotationId = useId();
  const cropId = useId();
  const cropHintId = useId();
  const videoBitrateId = useId();
  const videoBitrateHintId = useId();
  const crfId = useId();
  const audioBitrateId = useId();
  const sampleRateId = useId();
  const sampleRateHintId = useId();
  const volumeId = useId();
  const volumeHintId = useId();

  return (
    <div className="flex flex-col gap-4">
      <OptionGroup title={t("media.group.video")}>
        <FieldRow label={t("media.fields.scaleWidth")} htmlFor={scaleWidthId}>
          <Input
            id={scaleWidthId}
            placeholder={t("media.fields.keepEmpty")}
            value={form.width}
            onChange={(event) => onUpdate({ width: event.currentTarget.value })}
          />
        </FieldRow>
        <FieldRow label={t("media.fields.scaleHeight")} htmlFor={scaleHeightId}>
          <Input
            id={scaleHeightId}
            placeholder={t("media.fields.keepEmpty")}
            value={form.height}
            onChange={(event) => onUpdate({ height: event.currentTarget.value })}
          />
        </FieldRow>
        <FieldRow label={t("media.fields.frameRate")} htmlFor={frameRateId}>
          <Input
            id={frameRateId}
            value={form.frameRate}
            onChange={(event) => onUpdate({ frameRate: event.currentTarget.value })}
          />
        </FieldRow>
        <FieldRow label={t("media.fields.speed")} htmlFor={speedId}>
          <NumberField
            id={speedId}
            step={0.25}
            min={0.25}
            value={form.speed}
            onChange={(value) => onUpdate({ speed: value ?? defaultMediaForm.speed })}
          />
        </FieldRow>
        <FieldRow label={t("media.fields.rotation")} htmlFor={rotationId}>
          <Select
            value={form.rotation}
            onValueChange={(value) => onUpdate({ rotation: value as MediaFormState["rotation"] })}
          >
            <SelectTrigger id={rotationId} aria-label={t("media.fields.rotation")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROTATION_OPTIONS.map(({ value, labelKey, label }) => (
                <SelectItem key={value} value={value}>
                  {labelKey ? t(labelKey) : (label as string)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label={t("media.fields.crop")} htmlFor={cropId}>
          <Input
            id={cropId}
            aria-describedby={cropHintId}
            placeholder={t("media.fields.cropHint")}
            value={form.crop}
            onChange={(event) => onUpdate({ crop: event.currentTarget.value })}
          />
          <p id={cropHintId} className="sr-only">
            {t("media.fields.cropHint")}
          </p>
        </FieldRow>
        <SwitchTileGrid items={mediaSwitchTileItems(VIDEO_SWITCHES, form, onUpdate)} columns={3} />
      </OptionGroup>
      <OptionGroup title={t("media.group.encoding")}>
        <FieldRow label={t("media.fields.videoBitrate")} htmlFor={videoBitrateId}>
          <Input
            id={videoBitrateId}
            aria-describedby={videoBitrateHintId}
            placeholder={t("media.fields.videoBitrateHint")}
            value={form.videoBitrate}
            onChange={(event) => onUpdate({ videoBitrate: event.currentTarget.value })}
          />
          <p id={videoBitrateHintId} className="sr-only">
            {t("media.fields.videoBitrateHint")}
          </p>
        </FieldRow>
        <FieldRow label="CRF" htmlFor={crfId}>
          <Input
            id={crfId}
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
        <FieldRow label={t("media.fields.audioBitrate")} htmlFor={audioBitrateId}>
          <Input
            id={audioBitrateId}
            value={form.audioBitrate}
            onChange={(event) => onUpdate({ audioBitrate: event.currentTarget.value })}
          />
        </FieldRow>
        <FieldRow label={t("media.fields.sampleRate")} htmlFor={sampleRateId}>
          <Input
            id={sampleRateId}
            aria-describedby={sampleRateHintId}
            placeholder={t("media.fields.sampleRateHint")}
            value={form.sampleRate}
            onChange={(event) => onUpdate({ sampleRate: event.currentTarget.value })}
          />
          <p id={sampleRateHintId} className="sr-only">
            {t("media.fields.sampleRateHint")}
          </p>
        </FieldRow>
        <FieldRow label={t("media.fields.volume")} htmlFor={volumeId}>
          <Input
            id={volumeId}
            aria-describedby={volumeHintId}
            placeholder={t("media.fields.volumeHint")}
            value={form.volume}
            onChange={(event) => onUpdate({ volume: event.currentTarget.value })}
          />
          <p id={volumeHintId} className="sr-only">
            {t("media.fields.volumeHint")}
          </p>
        </FieldRow>
        <SwitchTileGrid items={mediaSwitchTileItems(AUDIO_SWITCHES, form, onUpdate)} columns={3} />
      </OptionGroup>
    </div>
  );
}
