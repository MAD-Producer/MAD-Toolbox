import { useId } from "react";
import { FieldRow } from "../../components/common/FieldRow";
import { NumberField } from "../../components/ui/number-field";
import { t } from "../../locale";
import { defaultMediaForm, type MediaFormState } from "./form";
import type { MediaPageOperation } from "./workflow";

interface MediaGifFieldsProps {
  operation: MediaPageOperation;
  form: MediaFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaGifFields({ operation, form, disabled, onUpdate }: MediaGifFieldsProps) {
  const fpsId = useId();
  const widthId = useId();
  if (operation !== "gif") return null;

  return (
    <>
      <FieldRow label={t("media.fields.gifFps")} htmlFor={fpsId}>
        <NumberField
          id={fpsId}
          min={1}
          value={form.gifFps}
          onChange={(value) =>
            onUpdate({ gifFps: value ?? defaultMediaForm.gifFps })
          }
          disabled={disabled}
        />
      </FieldRow>
      <FieldRow label={t("media.fields.gifWidth")} htmlFor={widthId}>
        <NumberField
          id={widthId}
          min={16}
          value={form.gifWidth}
          onChange={(value) =>
            onUpdate({ gifWidth: value ?? defaultMediaForm.gifWidth })
          }
          disabled={disabled}
        />
      </FieldRow>
    </>
  );
}
