import type { ReactNode } from "react";

interface WorkspaceFrameProps {
  children: ReactNode;
}

/** 右侧工作区容器：占满侧栏以外的空间，内容为圆角卡片表面 */
export function WorkspaceFrame({ children }: WorkspaceFrameProps) {
  return (
    <div className="grid min-w-0 min-h-0 flex-1 grid-cols-[minmax(0,1fr)] p-4 pl-0">
      <main className="workspace-surface min-h-0 min-w-0 overflow-auto rounded-xl">{children}</main>
    </div>
  );
}
