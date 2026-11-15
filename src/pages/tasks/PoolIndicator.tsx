import type { Pool } from "../../contracts/types";
import { t, type TranslationKey } from "../../locale";
import { Progress } from "../../components/ui/progress";
import type { PoolDefinition } from "./api";

const POOL_LABEL_KEYS: Record<Pool, TranslationKey> = {
  download: "tasks.pool.download",
  local: "tasks.pool.local"
};

interface PoolIndicatorProps {
  definitions: PoolDefinition[];
  occupancy: (pool: Pool) => number;
}

/** 任务池占用指示：标签 + 用量计数 + 占用进度条（满载转红） */
export function PoolIndicator({ definitions, occupancy }: PoolIndicatorProps) {
  if (definitions.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {definitions.map(({ pool, capacity }) => {
        const used = occupancy(pool);
        const full = used >= capacity;
        const filled = capacity > 0 ? Math.min(used / capacity, 1) : 0;
        return (
          <div key={pool}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{t(POOL_LABEL_KEYS[pool])}</span>
              <span className={full ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {used}/{capacity}
              </span>
            </div>
            <Progress
              value={filled * 100}
              color={full ? "destructive" : "success"}
              aria-label={t(POOL_LABEL_KEYS[pool])}
            />
          </div>
        );
      })}
    </div>
  );
}
