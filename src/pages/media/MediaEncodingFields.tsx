import { useId } from "react";
import { FieldRow } from "../../components/common/FieldRow";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { t } from "../../locale";
import type { MediaFormState } from "./form";
import type { MediaPageOperation } from "./workflow";

interface MediaEncodingFieldsProps {
  operation: MediaPageOperation;
  form: MediaFormState;
  containers: string[] | undefined;
  videoCodecs: string[];
  audioCodecs: string[];
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

function CodecSelect({
  label,
  value,
  options,
  disabled,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const triggerId = useId();
  return (
    <FieldRow label={label} htmlFor={triggerId}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={triggerId} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldRow>
  );
}

export function MediaEncodingFields({
  operation,
  form,
  containers,
  videoCodecs,
  audioCodecs,
  disabled,
  onUpdate
}: MediaEncodingFieldsProps) {
  const showCodecs = operation === "transcode" || operation === "remux";

  return (
    <>
      {containers && (
        <CodecSelect
          label={t("media.fields.container")}
          value={form.container}
          options={containers}
          disabled={disabled}
          onChange={(container) => onUpdate({ container })}
        />
      )}
      {showCodecs && (
        <CodecSelect
          label={t("media.fields.videoCodec")}
          value={form.videoCodec}
          options={videoCodecs}
          disabled={disabled}
          onChange={(videoCodec) => onUpdate({ videoCodec })}
        />
      )}
      {(showCodecs || operation === "audio") && (
        <CodecSelect
          label={t("media.fields.audioCodec")}
          value={form.audioCodec}
          options={audioCodecs}
          disabled={disabled}
          onChange={(audioCodec) => onUpdate({ audioCodec })}
        />
      )}
    </>
  );
}
