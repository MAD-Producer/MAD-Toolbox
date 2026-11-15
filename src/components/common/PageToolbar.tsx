import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/**
 * 页内吸顶工具栏：四个业务页头共用的操作行（bilibili/network/music/media，D28）。
 * 与页面容器的约定——容器为 workspace-surface 内 p-5 的 flex-col：
 * -mx-5 -mt-5 拉满幅、px-5 pt-5 还原内边距；sticky top-0 + bg-card/95 + backdrop-blur
 * 滚动时钉住并模糊底下经过的内容（bg-card 对齐所在表面，workspace-surface 即 --card）；
 * border-border/40 淡线供滚动时辨认边界；z-20 与 Portal 层（dialog/tooltip/select 的 z-50）保持距离。
 * 内容为右对齐的动作按钮（依赖徽标 / 登录 / 提交等），由调用方给 children。
 */
export function PageToolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-5 -mt-5 flex items-center justify-end gap-2",
        "border-b border-border/40 bg-card/95 px-5 pb-3 pt-5 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}
