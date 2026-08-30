import { TextInput } from "@mantine/core";
import { FieldRow } from "../../components/common/FieldRow";
import { t } from "../../locale";
import type { MediaFormState } from "./form";
import type { MediaPageOperation } from "./workflow";

interface MediaExtractFieldsProps {
  operation: MediaPageOperation;
  form: MediaFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaExtractFields({
  operation,
  form,
  disabled,
  onUpdate
}: MediaExtractFieldsProps) {
  if (operation !== "video-extract" && operation !== "audio" && operation !== "subtitle-extract") {
    return null;
  }

  const value =
    operation === "audio"
      ? form.audioStreamIndex
      : operation === "video-extract"
        ? form.videoStreamIndex
        : form.subtitleStreamIndex;

  const update = (nextValue: string) => {
    if (operation === "audio") onUpdate({ audioStreamIndex: nextValue });
    else if (operation === "video-extract") onUpdate({ videoStreamIndex: nextValue });
    else onUpdate({ subtitleStreamIndex: nextValue });
  };

  return (
    <FieldRow label={t("media.fields.streamIndex")} hint={t("media.fields.streamIndexHint")}>
      <TextInput
        value={value}
        onChange={(event) => update(event.currentTarget.value)}
        disabled={disabled}
      />
    </FieldRow>
  );
}
