import { useId } from "react";
import { ArrowClockwise, Stack } from "@phosphor-icons/react";
import { FieldRow, OptionGroup, SwitchTileGrid } from "../../components/common/FieldRow";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { NumberField } from "../../components/ui/number-field";
import { t, type TranslationKey } from "../../locale";
import { defaultAria2Form, type Aria2FormState } from "./form";
import type { TrackerListResult } from "./api";

const BT_SWITCHES: ReadonlyArray<[keyof Aria2FormState, TranslationKey]> = [
  ["ptMode", "aria2.fields.ptMode"],
  ["injectTrackers", "aria2.fields.injectTrackers"],
  ["dht", "aria2.fields.dht"],
  ["peerExchange", "aria2.fields.peerExchange"],
  ["lpd", "aria2.fields.lpd"],
  ["seedAfterDownload", "aria2.fields.seedAfterDownload"]
];

interface Aria2AdvancedFieldsProps {
  form: Aria2FormState;
  disabled: boolean;
  onUpdate: (patch: Partial<Aria2FormState>) => void;
  trackerInfo: TrackerListResult | null;
  trackerLoading: boolean;
  onRefreshTrackers: () => void;
}

function toTileItems(
  items: ReadonlyArray<[keyof Aria2FormState, TranslationKey]>,
  form: Aria2FormState,
  onUpdate: Aria2AdvancedFieldsProps["onUpdate"]
) {
  return items.map(([key, labelKey]) => ({
    key,
    label: t(labelKey),
    checked: form[key] as boolean,
    onToggle: (checked: boolean) => onUpdate({ [key]: checked })
  }));
}

function formatFetchedAt(fetchedAt: string): string {
  const parsed = new Date(fetchedAt);
  if (Number.isNaN(parsed.getTime())) return fetchedAt;
  return new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(parsed);
}

export function Aria2AdvancedFields({
  form,
  disabled,
  onUpdate,
  trackerInfo,
  trackerLoading,
  onRefreshTrackers
}: Aria2AdvancedFieldsProps) {
  const splitId = useId();
  const maxConnId = useId();
  const btMaxPeersId = useId();
  const seedRatioId = useId();
  const seedTimeId = useId();
  const uaId = useId();
  const refererId = useId();
  const headerId = useId();
  const overallDlId = useId();
  const dlId = useId();
  const overallUlId = useId();
  const trackerRefreshId = useId();

  return (
    <div className="flex flex-col gap-4">
      <OptionGroup title={t("aria2.group.transfer")}>
        <FieldRow label={t("aria2.fields.split")} htmlFor={splitId}>
          <NumberField
            id={splitId}
            min={1}
            max={16}
            value={form.split}
            onChange={(value) => onUpdate({ split: value ?? defaultAria2Form.split })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow
          label={t("aria2.fields.maxConnectionPerServer")}
          htmlFor={maxConnId}
          hint={t("aria2.fields.maxConnectionHint")}
        >
          <NumberField
            id={maxConnId}
            min={1}
            max={16}
            value={form.maxConnectionPerServer}
            onChange={(value) =>
              onUpdate({ maxConnectionPerServer: value ?? defaultAria2Form.maxConnectionPerServer })
            }
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow label={t("aria2.fields.maxOverallDownloadLimit")} htmlFor={overallDlId}>
          <Input
            id={overallDlId}
            placeholder={t("aria2.fields.speedPlaceholder")}
            value={form.maxOverallDownloadLimit}
            onChange={(event) => onUpdate({ maxOverallDownloadLimit: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow label={t("aria2.fields.maxDownloadLimit")} htmlFor={dlId}>
          <Input
            id={dlId}
            placeholder={t("aria2.fields.speedPlaceholder")}
            value={form.maxDownloadLimit}
            onChange={(event) => onUpdate({ maxDownloadLimit: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow
          label={t("aria2.fields.maxOverallUploadLimit")}
          htmlFor={overallUlId}
          hint={t("aria2.fields.uploadLimitHint")}
        >
          <Input
            id={overallUlId}
            placeholder={t("aria2.fields.speedPlaceholder")}
            value={form.maxOverallUploadLimit}
            onChange={(event) => onUpdate({ maxOverallUploadLimit: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
      </OptionGroup>

      <OptionGroup title={t("aria2.group.bt")}>
        <SwitchTileGrid
          items={toTileItems(BT_SWITCHES, form, onUpdate)}
          columns={3}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">{t("aria2.tracker.scopeHint")}</p>
        <FieldRow
          label={t("aria2.tracker.label")}
          htmlFor={trackerRefreshId}
          hint={trackerHint(trackerInfo)}
        >
          <div className="flex h-9 w-full items-stretch rounded-md border border-input bg-card text-sm">
            <span className="flex min-w-0 flex-1 items-center gap-2 px-3 text-muted-foreground">
              <Stack size={16} className="shrink-0" aria-hidden />
              <span className="truncate">{t("aria2.tracker.merged")}</span>
            </span>
            <span className="my-1.5 w-px shrink-0 bg-input" aria-hidden />
            <Button
              id={trackerRefreshId}
              variant="ghost"
              className="shrink-0 gap-1.5 rounded-r-md rounded-l-none px-3"
              leftSection={<ArrowClockwise size={16} />}
              loading={trackerLoading}
              onClick={onRefreshTrackers}
              disabled={disabled}
            >
              {t("aria2.tracker.refresh")}
            </Button>
          </div>
        </FieldRow>
        <FieldRow label={t("aria2.fields.btMaxPeers")} htmlFor={btMaxPeersId}>
          <NumberField
            id={btMaxPeersId}
            min={0}
            value={form.btMaxPeers}
            onChange={(value) => onUpdate({ btMaxPeers: value ?? defaultAria2Form.btMaxPeers })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow
          label={t("aria2.fields.seedRatio")}
          htmlFor={seedRatioId}
          hint={t("aria2.fields.seedRatioHint")}
        >
          <NumberField
            id={seedRatioId}
            min={0}
            max={10000}
            step={0.1}
            value={form.seedRatio}
            onChange={(value) => onUpdate({ seedRatio: value ?? defaultAria2Form.seedRatio })}
            disabled={disabled || !form.seedAfterDownload}
          />
        </FieldRow>
        <FieldRow
          label={t("aria2.fields.seedTimeMinutes")}
          htmlFor={seedTimeId}
          hint={t("aria2.fields.seedTimeHint")}
        >
          <NumberField
            id={seedTimeId}
            min={0}
            value={form.seedTimeMinutes}
            onChange={(value) =>
              onUpdate({ seedTimeMinutes: value ?? defaultAria2Form.seedTimeMinutes })
            }
            disabled={disabled || !form.seedAfterDownload}
          />
        </FieldRow>
        <p className="text-xs text-muted-foreground">{t("aria2.utpNote")}</p>
      </OptionGroup>

      <OptionGroup title={t("aria2.group.http")}>
        <FieldRow label={t("aria2.fields.userAgent")} htmlFor={uaId}>
          <Input
            id={uaId}
            placeholder={t("aria2.fields.userAgentPlaceholder")}
            value={form.userAgent}
            onChange={(event) => onUpdate({ userAgent: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow label={t("aria2.fields.referer")} htmlFor={refererId}>
          <Input
            id={refererId}
            placeholder="https://…"
            value={form.referer}
            onChange={(event) => onUpdate({ referer: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow
          label={t("aria2.fields.header")}
          htmlFor={headerId}
          hint={t("aria2.fields.headerHint")}
        >
          <Input
            id={headerId}
            placeholder="Cookie: k=v"
            value={form.header}
            onChange={(event) => onUpdate({ header: event.currentTarget.value })}
            disabled={disabled}
          />
        </FieldRow>
      </OptionGroup>
    </div>
  );
}

function trackerHint(trackerInfo: TrackerListResult | null): string {
  if (!trackerInfo) return t("aria2.tracker.notLoaded");
  return t(trackerInfo.cached ? "aria2.tracker.cachedHint" : "aria2.tracker.freshHint", {
    count: trackerInfo.trackers.length,
    time: formatFetchedAt(trackerInfo.fetchedAt)
  });
}
