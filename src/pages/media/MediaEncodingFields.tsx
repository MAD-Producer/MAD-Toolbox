import { Select } from "@mantine/core";
import { FieldRow } from "../../components/common/FieldRow";
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
        <FieldRow label={t("media.fields.container")}>
          <Select
            data={containers}
            value={containers.includes(form.container) ? form.container : containers[0]}
            onChange={(value) => value && onUpdate({ container: value })}
            disabled={disabled}
            allowDeselect={false}
          />
        </FieldRow>
      )}
      {showCodecs && (
        <FieldRow label={t("media.fields.videoCodec")}>
          <Select
            data={videoCodecs}
            value={form.videoCodec}
            onChange={(value) => value && onUpdate({ videoCodec: value })}
            disabled={disabled}
            allowDeselect={false}
          />
        </FieldRow>
      )}
      {(showCodecs || operation === "audio") && (
        <FieldRow label={t("media.fields.audioCodec")}>
          <Select
            data={audioCodecs}
            value={form.audioCodec}
            onChange={(value) => value && onUpdate({ audioCodec: value })}
            disabled={disabled}
            allowDeselect={false}
          />
        </FieldRow>
      )}
    </>
  );
}
