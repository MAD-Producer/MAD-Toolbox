import { Badge, Tooltip } from "@mantine/core";
import { t } from "../../locale";

interface DependencyMissingBadgeProps {
  labels?: string[];
  onOpen?: () => void;
}

/** 功能页标题旁的依赖缺失警示：红边红字无填充，点击跳转设置的依赖页。 */
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
