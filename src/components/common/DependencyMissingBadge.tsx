import { t } from "../../locale";
import { Badge } from "../ui/badge";
import { Tooltip } from "../ui/tooltip";

interface DependencyMissingBadgeProps {
  labels?: string[];
  onOpen?: () => void;
}

/** 外部依赖缺失提示徽标：点击跳转依赖设置页 */
export function DependencyMissingBadge({ labels, onOpen }: DependencyMissingBadgeProps) {
  if (!labels?.length || !onOpen) return null;
  return (
    <Tooltip label={t("deps.badgeTooltip")}>
      <button
        type="button"
        onClick={onOpen}
        className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Badge variant="error" className="px-3 py-1">
          {t("deps.missingBadge", { names: labels })}
        </Badge>
      </button>
    </Tooltip>
  );
}
