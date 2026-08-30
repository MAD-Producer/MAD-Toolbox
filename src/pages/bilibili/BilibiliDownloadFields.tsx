import { Stack, TextInput } from "@mantine/core";
import { FieldRow } from "../../components/common/FieldRow";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
import { t } from "../../locale";
import type { BilibiliFormState } from "./form";

interface BilibiliDownloadFieldsProps {
  form: BilibiliFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<BilibiliFormState>) => void;
  onPickOutputDirectory: () => Promise<void>;
}

export function BilibiliDownloadFields({
  form,
  disabled,
  onUpdate,
  onPickOutputDirectory
}: BilibiliDownloadFieldsProps) {
  return (
    <Stack gap="md">
      <FieldRow label={t("bilibili.fields.url")}>
        <TextInput
          placeholder={t("bilibili.fields.urlPlaceholder")}
          value={form.url}
          onChange={(event) => onUpdate({ url: event.currentTarget.value })}
          disabled={disabled}
        />
      </FieldRow>
      <FieldRow label={t("bilibili.fields.pages")}>
        <TextInput
          placeholder={t("bilibili.fields.pagesPlaceholder")}
          value={form.pages}
          onChange={(event) => onUpdate({ pages: event.currentTarget.value })}
          disabled={disabled}
        />
      </FieldRow>
      <FieldRow label={t("common.outputDirectory")} hint={t("common.outputDirectoryHint")}>
        <OutputDirectoryField
          bare
          value={form.outputDirectory}
          disabled={disabled}
          placeholder={t("bilibili.fields.outputPlaceholder")}
          onChange={(outputDirectory) => onUpdate({ outputDirectory })}
          onBrowse={onPickOutputDirectory}
        />
      </FieldRow>
    </Stack>
  );
}
