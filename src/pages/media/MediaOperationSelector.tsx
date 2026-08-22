import { Select } from "@mantine/core";
import { MEDIA_OPERATION_OPTIONS, type MediaPageOperation } from "./workflow";
import { t } from "../../locale";

interface MediaOperationSelectorProps {
  operations: readonly MediaPageOperation[];
  value: MediaPageOperation;
  disabled: boolean;
  onChange: (operation: MediaPageOperation) => void;
}

export function MediaOperationSelector({
  operations,
  value,
  disabled,
  onChange
}: MediaOperationSelectorProps) {
  if (operations.length <= 1) return null;

  return (
    <Select
      label={t("media.operationLabel")}
      data={MEDIA_OPERATION_OPTIONS.filter((option) => operations.includes(option.value)).map(
        ({ value, labelKey }) => ({ value, label: t(labelKey) })
      )}
      value={value}
      onChange={(nextValue) => nextValue && onChange(nextValue as MediaPageOperation)}
      disabled={disabled}
      allowDeselect={false}
    />
  );
}
