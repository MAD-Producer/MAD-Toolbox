import { SwitchTileGrid } from "../../components/common/FieldRow";
import { t, type TranslationKey } from "../../locale";
import type { MediaFormState } from "./form";

const TASK_OPTION_SWITCHES: ReadonlyArray<[keyof MediaFormState, TranslationKey]> = [
  ["mapAll", "media.options.mapAll"],
  ["preserveMetadata", "media.options.preserveMetadata"],
  ["overwrite", "media.options.overwrite"]
];

interface MediaTaskOptionsProps {
  form: MediaFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaTaskOptions({ form, disabled, onUpdate }: MediaTaskOptionsProps) {
  return (
    <SwitchTileGrid
      items={TASK_OPTION_SWITCHES.map(([key, labelKey]) => ({
        key,
        label: t(labelKey),
        checked: form[key] as boolean,
        onToggle: (checked) => onUpdate({ [key]: checked })
      }))}
      columns={3}
      disabled={disabled}
    />
  );
}
