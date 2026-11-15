import { useId } from "react";
import { FieldRow } from "../../components/common/FieldRow";
import { NumberField } from "../../components/ui/number-field";
import { Textarea } from "../../components/ui/textarea";
import { t, type TranslationKey } from "../../locale";
import { DEFAULT_THREAD_COUNT, type MusicFormPatch, type MusicFormState } from "./configuration";

interface MusicAdvancedSettingsProps {
  form: MusicFormState;
  onChange: (patch: MusicFormPatch) => void;
}

type RawConfigField = "rawInit" | "rawRequests" | "rawThreadings" | "rawSearchRules";

const RAW_TEXTAREA_ROWS: ReadonlyArray<
  ReadonlyArray<{ field: RawConfigField; labelKey: TranslationKey }>
> = [
  [
    { field: "rawInit", labelKey: "music.advanced.initLabel" },
    { field: "rawRequests", labelKey: "music.advanced.requestsLabel" }
  ],
  [
    { field: "rawThreadings", labelKey: "music.advanced.threadingsLabel" },
    { field: "rawSearchRules", labelKey: "music.advanced.searchRulesLabel" }
  ]
];

export function MusicAdvancedSettings({ form, onChange }: MusicAdvancedSettingsProps) {
  const threadCountId = useId();
  const threadCountHintId = useId();
  const rawHintId = useId();

  return (
    <div className="flex flex-col gap-4">
      <FieldRow
        label={t("music.threadCount.label")}
        hint={t("music.threadCount.description")}
        htmlFor={threadCountId}
        hintId={threadCountHintId}
      >
        <NumberField
          id={threadCountId}
          aria-describedby={threadCountHintId}
          min={1}
          max={50}
          value={form.threadCount}
          onChange={(value) => onChange({ threadCount: value ?? DEFAULT_THREAD_COUNT })}
        />
      </FieldRow>
      <p id={rawHintId} className="text-xs text-muted-foreground">
        {t("music.advanced.hint")}
      </p>
      {RAW_TEXTAREA_ROWS.map((row) => (
        <div key={row[0].field} className="grid grid-cols-2 items-start gap-3">
          {row.map(({ field, labelKey }) => (
            <RawConfigTextarea
              key={field}
              label={t(labelKey)}
              value={form[field]}
              describedById={rawHintId}
              onChange={(value) => onChange({ [field]: value })}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function RawConfigTextarea({
  label,
  value,
  describedById,
  onChange
}: {
  label: string;
  value: string;
  describedById?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Textarea
        id={id}
        aria-describedby={describedById}
        autosize
        rows={3}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-0 font-mono text-xs"
      />
    </div>
  );
}
