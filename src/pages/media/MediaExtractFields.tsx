import { useId } from "react";
import { FieldRow } from "../../components/common/FieldRow";
import { Input } from "../../components/ui/input";
import { t } from "../../locale";
import type { MediaFormState } from "./form";
import type { MediaPageOperation } from "./workflow";

interface MediaExtractFieldsProps {
  operation: MediaPageOperation;
  form: MediaFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

const STREAM_INDEX_FIELD = {
  audio: "audioStreamIndex",
  "video-extract": "videoStreamIndex",
  "subtitle-extract": "subtitleStreamIndex"
} as const;

export function MediaExtractFields({
  operation,
  form,
  disabled,
  onUpdate
}: MediaExtractFieldsProps) {
  const inputId = useId();
  const hintId = useId();
  if (!(operation in STREAM_INDEX_FIELD)) return null;

  const field = STREAM_INDEX_FIELD[operation as keyof typeof STREAM_INDEX_FIELD];
  return (
    <FieldRow
      label={t("media.fields.streamIndex")}
      hint={t("media.fields.streamIndexHint")}
      htmlFor={inputId}
      hintId={hintId}
    >
      <Input
        id={inputId}
        aria-describedby={hintId}
        value={form[field]}
        onChange={(event) => onUpdate({ [field]: event.currentTarget.value })}
        disabled={disabled}
      />
    </FieldRow>
  );
}
