import { useId } from "react";
import { FieldRow } from "../../components/common/FieldRow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../../components/ui/select";
import { t } from "../../locale";
import { MEDIA_OPERATION_OPTIONS, type MediaPageOperation } from "./workflow";

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
  const triggerId = useId();
  if (operations.length <= 1) return null;

  return (
    <FieldRow label={t("media.operationLabel")} htmlFor={triggerId}>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as MediaPageOperation)}
        disabled={disabled}
      >
        <SelectTrigger id={triggerId} aria-label={t("media.operationLabel")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MEDIA_OPERATION_OPTIONS.filter((option) => operations.includes(option.value)).map(
            ({ value, labelKey }) => (
              <SelectItem key={value} value={value}>
                {t(labelKey)}
              </SelectItem>
            )
          )}
        </SelectContent>
      </Select>
    </FieldRow>
  );
}
