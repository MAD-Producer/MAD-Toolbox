import type { SwitchTileItem } from "../../components/common/FieldRow";
import { t, type TranslationKey } from "../../locale";
import type { MediaFormState } from "./form";

export interface MediaSwitchSpec {
  key: keyof MediaFormState;
  labelKey?: TranslationKey;
  label?: string;
}

export function mediaSwitchTileItems(
  switches: ReadonlyArray<MediaSwitchSpec>,
  form: MediaFormState,
  onUpdate: (patch: Partial<MediaFormState>) => void
): SwitchTileItem[] {
  return switches.map(({ key, labelKey, label }) => ({
    key,
    label: labelKey ? t(labelKey) : (label as string),
    checked: form[key] as boolean,
    onToggle: (checked) => onUpdate({ [key]: checked })
  }));
}
