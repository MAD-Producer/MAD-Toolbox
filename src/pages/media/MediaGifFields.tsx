import { Group, NumberInput } from "@mantine/core";
import { t } from "../../locale";
import type { MediaFormState } from "./form";
import type { MediaPageOperation } from "./workflow";

interface MediaGifFieldsProps {
  operation: MediaPageOperation;
  form: MediaFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaGifFields({ operation, form, disabled, onUpdate }: MediaGifFieldsProps) {
  if (operation !== "gif") return null;

  return (
    <Group grow>
      <NumberInput
        label={t("media.fields.gifFps")}
        min={1}
        value={form.gifFps}
        onChange={(value) => onUpdate({ gifFps: typeof value === "number" ? value : 12 })}
        disabled={disabled}
      />
      <NumberInput
        label={t("media.fields.gifWidth")}
        min={16}
        value={form.gifWidth}
        onChange={(value) => onUpdate({ gifWidth: typeof value === "number" ? value : 720 })}
        disabled={disabled}
      />
    </Group>
  );
}
