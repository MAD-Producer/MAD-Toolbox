import { useId } from "react";
import { FieldRow } from "../../components/common/FieldRow";
import { Input } from "../../components/ui/input";
import { t } from "../../locale";
import type { MediaFormState } from "./form";

interface MediaTimeRangeFieldsProps {
  form: MediaFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaTimeRangeFields({ form, disabled, onUpdate }: MediaTimeRangeFieldsProps) {
  const startId = useId();
  const startHintId = useId();
  const durationId = useId();
  const durationHintId = useId();

  return (
    <>
      <FieldRow label={t("media.fields.startTime")} htmlFor={startId}>
        <Input
          id={startId}
          aria-describedby={startHintId}
          placeholder={t("media.fields.startTimeHint")}
          value={form.startTime}
          onChange={(event) => onUpdate({ startTime: event.currentTarget.value })}
          disabled={disabled}
        />
        {/* placeholder 读屏不播报格式提示，用隐藏文本建立 describedby 关联 */}
        <p id={startHintId} className="sr-only">
          {t("media.fields.startTimeHint")}
        </p>
      </FieldRow>
      <FieldRow label={t("media.fields.duration")} htmlFor={durationId}>
        <Input
          id={durationId}
          aria-describedby={durationHintId}
          placeholder={t("media.fields.durationHint")}
          value={form.duration}
          onChange={(event) => onUpdate({ duration: event.currentTarget.value })}
          disabled={disabled}
        />
        <p id={durationHintId} className="sr-only">
          {t("media.fields.durationHint")}
        </p>
      </FieldRow>
    </>
  );
}
