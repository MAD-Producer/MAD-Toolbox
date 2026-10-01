import { Box } from "@mantine/core";
import type { ReactNode } from "react";

interface WorkspaceFrameProps {
  children: ReactNode;
}

export function WorkspaceFrame({ children }: WorkspaceFrameProps) {
  return (
    <Box
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        margin: "0 16px"
      }}
    >
      <Box
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
