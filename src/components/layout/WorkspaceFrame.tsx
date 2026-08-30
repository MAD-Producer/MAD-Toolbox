import { Box } from "@mantine/core";
import type { ReactNode } from "react";

interface WorkspaceFrameProps {
  navigation?: ReactNode;
  children: ReactNode;
}

export function WorkspaceFrame({ navigation, children }: WorkspaceFrameProps) {
  return (
    <Box
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: navigation ? "134px minmax(0, 1fr)" : "minmax(0, 1fr)",
        margin: "0 16px"
      }}
    >
      {navigation ? (
        <Box
          key="navigation"
          component="aside"
          style={{
            minHeight: 0,
            overflowY: "auto",
            borderRight: "1px solid var(--mantine-color-default-border)"
          }}
        >
          {navigation}
        </Box>
      ) : null}
      <Box
        key="workspace"
        component="main"
        className="workspace-surface"
        style={{
          minWidth: 0,
          minHeight: 0,
          overflow: "auto",
          borderRadius: "10px"
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
