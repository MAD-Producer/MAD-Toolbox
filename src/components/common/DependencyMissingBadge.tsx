import { Badge, Tooltip } from "@mantine/core";
import { t } from "../../locale";

interface DependencyMissingBadgeProps {
  labels?: string[];
  onOpen?: () => void;
}

export function DependencyMissingBadge({ labels, onOpen }: DependencyMissingBadgeProps) {
  if (!labels?.length || !onOpen) return null;
  return (
    <Tooltip
      label={t("deps.badgeTooltip")}
      position="bottom"
      events={{ hover: true, focus: true, touch: true }}
    >
      <Badge variant="outline" color="red" size="lg" style={{ cursor: "pointer" }} onClick={onOpen}>
        {t("deps.missingBadge", { names: labels })}
      </Badge>
    </Tooltip>
  );
}
