import { Group, TextInput } from "@mantine/core";
import { t } from "../../locale";
import type { MediaFormState } from "./form";

interface MediaTimeRangeFieldsProps {
  form: MediaFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaTimeRangeFields({ form, disabled, onUpdate }: MediaTimeRangeFieldsProps) {
  return (
    <Group grow>
      <TextInput
        label={t("media.fields.startTime")}
        placeholder={t("media.fields.startTimeHint")}
        value={form.startTime}
        onChange={(event) => onUpdate({ startTime: event.currentTarget.value })}
        disabled={disabled}
      />
      <TextInput
        label={t("media.fields.duration")}
        placeholder={t("media.fields.durationHint")}
        value={form.duration}
        onChange={(event) => onUpdate({ duration: event.currentTarget.value })}
        disabled={disabled}
      />
    </Group>
  );
}
