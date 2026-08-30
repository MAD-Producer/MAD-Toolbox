import { SegmentedControl } from "@mantine/core";

interface L2TabNavProps<PageId extends string> {
  items: readonly { page: PageId; label: string }[];
  value: PageId;
  onChange: (page: PageId) => void;
  badges?: Partial<Record<PageId, number>>;
  "aria-label": string;
}

export function L2TabNav<PageId extends string>({
  items,
  value,
  onChange,
  badges,
  "aria-label": ariaLabel
}: L2TabNavProps<PageId>) {
  return (
    <SegmentedControl
      className="l2-tabnav"
      w="100%"
      radius="lg"
      value={value}
      onChange={(next) => onChange(next as PageId)}
      data={items.map(({ page, label }) => {
        const badge = badges?.[page] ?? 0;
        return {
          value: page,
          label:
            badge > 0 ? (
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                {label}
                <span className="l2-tabnav-count">{badge}</span>
              </span>
            ) : (
              label
            )
        };
      })}
      aria-label={ariaLabel}
    />
  );
}
