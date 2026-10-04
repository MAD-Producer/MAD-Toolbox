import { Suspense, useEffect, type ReactNode } from "react";
import { useWorkspacesStore, type WorkspaceId } from "../../stores/workspaces";
import { WorkspaceSlot } from "./WorkspaceSlot";

export interface WorkspaceDefinition {
  id: WorkspaceId;
  render: (active: boolean, generation: number) => ReactNode;
}

interface WorkspaceSessionHostProps {
  activeWorkspace: WorkspaceId | null;
  workspaces: readonly WorkspaceDefinition[];
  fallback?: ReactNode;
}

export function WorkspaceSessionHost({
  activeWorkspace,
  workspaces,
  fallback = null
}: WorkspaceSessionHostProps) {
  const sessions = useWorkspacesStore((state) => state.sessions);
  const visit = useWorkspacesStore((state) => state.visit);
  const evictIfReleasable = useWorkspacesStore((state) => state.evictIfReleasable);

  useEffect(() => {
    if (activeWorkspace !== null) {
      visit(activeWorkspace);
    }
  }, [activeWorkspace, visit]);

  useEffect(() => {
    for (const id of Object.keys(sessions) as WorkspaceId[]) {
      const session = sessions[id];
      if (id !== activeWorkspace && session.status === "releasable") {
        evictIfReleasable(id);
      }
    }
  }, [activeWorkspace, evictIfReleasable, sessions]);

  return workspaces.map((workspace) => {
    const session = sessions[workspace.id];
    const active = workspace.id === activeWorkspace;
    if (session.status === "unmounted" && !active) return null;

    return (
      <WorkspaceSlot
        key={workspace.id}
        id={workspace.id}
        active={active}
        generation={session.generation}
      >
        <Suspense fallback={active ? fallback : null}>
          {workspace.render(active, session.generation)}
        </Suspense>
      </WorkspaceSlot>
    );
  });
}
