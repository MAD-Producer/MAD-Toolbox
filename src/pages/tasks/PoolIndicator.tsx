import { Box, Group, Stack, Text } from "@mantine/core";
import type { Pool } from "../../contracts/types";
import { t, type TranslationKey } from "../../locale";
import type { PoolDefinition } from "./api";

const POOL_LABEL_KEYS: Record<Pool, TranslationKey> = {
  download: "tasks.pool.download",
  local: "tasks.pool.local"
};

interface PoolIndicatorProps {
  definitions: PoolDefinition[];
  occupancy: (pool: Pool) => number;
}

export function PoolIndicator({ definitions, occupancy }: PoolIndicatorProps) {
  if (definitions.length === 0) return null;
  return (
    <Stack gap="sm">
      {definitions.map(({ pool, capacity }) => {
        const used = occupancy(pool);
        const full = used >= capacity;
        const filled = capacity > 0 ? Math.min(used / capacity, 1) : 0;
        return (
          <Box key={pool}>
            <Group justify="space-between" mb={5} wrap="nowrap">
              <Text size="xs" c="dimmed">
                {t(POOL_LABEL_KEYS[pool])}
              </Text>
              <Text size="xs" c={full ? "red" : "dimmed"}>
                {used}/{capacity}
              </Text>
            </Group>
            <Box
              h={6}
              style={{
                borderRadius: "var(--mantine-radius-sm)",
                background: "var(--mantine-color-default-hover)",
                overflow: "hidden"
              }}
            >
              <Box
                h="100%"
                w={`${filled * 100}%`}
                style={{
                  background: full
                    ? "var(--mantine-color-red-filled)"
                    : "var(--mantine-color-green-filled)"
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
