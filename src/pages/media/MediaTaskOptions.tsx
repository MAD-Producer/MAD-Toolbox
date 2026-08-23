import { Group, Switch } from "@mantine/core";
import { t } from "../../locale";
import type { MediaFormState } from "./form";

interface MediaTaskOptionsProps {
  form: MediaFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaTaskOptions({ form, disabled, onUpdate }: MediaTaskOptionsProps) {
  return (
    <Group gap="lg">
      <Switch
        label={t("media.options.mapAll")}
        checked={form.mapAll}
        onChange={(event) => onUpdate({ mapAll: event.currentTarget.checked })}
        disabled={disabled}
      />
      <Switch
        label={t("media.options.preserveMetadata")}
        checked={form.preserveMetadata}
        onChange={(event) => onUpdate({ preserveMetadata: event.currentTarget.checked })}
        disabled={disabled}
      />
      <Switch
        label={t("media.options.overwrite")}
        checked={form.overwrite}
        onChange={(event) => onUpdate({ overwrite: event.currentTarget.checked })}
        disabled={disabled}
      />
    </Group>
  );
}
