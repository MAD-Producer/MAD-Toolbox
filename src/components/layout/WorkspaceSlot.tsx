import { Activity, Fragment, type ReactNode } from "react";
import type { WorkspaceId } from "../../stores/workspaces";

interface WorkspaceSlotProps {
  id: WorkspaceId;
  active: boolean;
  generation: number;
  children: ReactNode;
}

export function WorkspaceSlot({ id, active, generation, children }: WorkspaceSlotProps) {
  return (
    <Activity name={id} mode={active ? "visible" : "hidden"}>
      <Fragment key={generation}>
        <div className="workspace-enter">{children}</div>
      </Fragment>
    </Activity>
  );
}
