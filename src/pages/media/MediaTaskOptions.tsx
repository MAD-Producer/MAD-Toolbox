import { SwitchTileGrid } from "../../components/common/FieldRow";
import { t } from "../../locale";
import { mediaSwitchTileItems, type MediaSwitchSpec } from "./switchTiles";
import type { MediaFormState } from "./form";

const TASK_OPTION_SWITCHES: ReadonlyArray<MediaSwitchSpec> = [
  { key: "mapAll", labelKey: "media.options.mapAll" },
  { key: "preserveMetadata", labelKey: "media.options.preserveMetadata" },
  { key: "overwrite", labelKey: "media.options.overwrite" }
];

interface MediaTaskOptionsProps {
  form: MediaFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaTaskOptions({ form, disabled, onUpdate }: MediaTaskOptionsProps) {
  return (
    <SwitchTileGrid
      items={mediaSwitchTileItems(TASK_OPTION_SWITCHES, form, onUpdate)}
      columns={3}
      disabled={disabled}
    />
  );
}
