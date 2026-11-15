import { useId } from "react";
import { FieldRow } from "../../components/common/FieldRow";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
import { Input } from "../../components/ui/input";
import { resolveDefaultOutputDirectory } from "../../lib/platform";
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
  const urlId = useId();
  const pagesId = useId();
  const outputId = useId();
  const outputHintId = useId();

  return (
    <div className="flex flex-col gap-4">
      <FieldRow label={t("bilibili.fields.url")} htmlFor={urlId}>
        <Input
          id={urlId}
          placeholder={t("bilibili.fields.urlPlaceholder")}
          value={form.url}
          onChange={(event) => onUpdate({ url: event.currentTarget.value })}
          disabled={disabled}
        />
      </FieldRow>
      <FieldRow label={t("bilibili.fields.pages")} htmlFor={pagesId}>
        <Input
          id={pagesId}
          placeholder={t("bilibili.fields.pagesPlaceholder")}
          value={form.pages}
          onChange={(event) => onUpdate({ pages: event.currentTarget.value })}
          disabled={disabled}
        />
      </FieldRow>
      <FieldRow
        label={t("common.outputDirectory")}
        hint={t("common.outputDirectoryHint")}
        htmlFor={outputId}
        hintId={outputHintId}
      >
        <OutputDirectoryField
          inputId={outputId}
          describedById={outputHintId}
          value={form.outputDirectory}
          disabled={disabled}
          placeholder={t("bilibili.fields.outputPlaceholder")}
          onChange={(outputDirectory) => onUpdate({ outputDirectory })}
          onBrowse={onPickOutputDirectory}
          resolveDefault={resolveDefaultOutputDirectory}
        />
      </FieldRow>
    </div>
  );
}
