import { Suspense, type ReactNode } from "react";
import { useWorkspacesStore, type WorkspaceId } from "../../stores/workspaces";
import { WorkspaceSlot } from "./WorkspaceSlot";
import type { TaskSeed } from "../../contracts/types";

export interface WorkspaceDefinition {
  id: WorkspaceId;
  render: (active: boolean, generation: number, seed: TaskSeed | null) => ReactNode;
}

interface WorkspaceSessionHostProps {
  activeWorkspace: WorkspaceId | null;
  workspaces: readonly WorkspaceDefinition[];
  fallback?: ReactNode;
}

// visit 与可释放会话的驱逐由 App.navigate 在导航事件里直接驱动，这里只做纯渲染
export function WorkspaceSessionHost({
  activeWorkspace,
  workspaces,
  fallback = null
}: WorkspaceSessionHostProps) {
  const sessions = useWorkspacesStore((state) => state.sessions);

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
          {workspace.render(active, session.generation, session.seed)}
        </Suspense>
      </WorkspaceSlot>
    );
  });
}
