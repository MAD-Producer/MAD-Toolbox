import { Box, Group, type GroupProps } from "@mantine/core";
import type { ReactNode } from "react";

interface FieldWithActionsProps extends GroupProps {
  children: ReactNode;
  actions?: ReactNode;
}

export function FieldWithActions({ children, actions, ...groupProps }: FieldWithActionsProps) {
  return (
    <Group gap={8} wrap="nowrap" align="center" {...groupProps}>
      <Box style={{ flex: "1 1 auto", minWidth: 0 }}>{children}</Box>
      {actions}
    </Group>
  );
}
