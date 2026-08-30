import { TextInput } from "@mantine/core";
import { FieldRow } from "../../components/common/FieldRow";
import { t } from "../../locale";
import type { MediaFormState } from "./form";

interface MediaTimeRangeFieldsProps {
  form: MediaFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaTimeRangeFields({ form, disabled, onUpdate }: MediaTimeRangeFieldsProps) {
  return (
    <>
      <FieldRow label={t("media.fields.startTime")}>
        <TextInput
          placeholder={t("media.fields.startTimeHint")}
          value={form.startTime}
          onChange={(event) => onUpdate({ startTime: event.currentTarget.value })}
          disabled={disabled}
        />
      </FieldRow>
      <FieldRow label={t("media.fields.duration")}>
        <TextInput
          placeholder={t("media.fields.durationHint")}
          value={form.duration}
          onChange={(event) => onUpdate({ duration: event.currentTarget.value })}
          disabled={disabled}
        />
      </FieldRow>
    </>
  );
}
