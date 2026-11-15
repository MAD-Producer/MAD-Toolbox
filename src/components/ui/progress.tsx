import { cn } from "../../lib/cn";

/**
 * indeterminate 流动动画的 keyframes。
 * 取舍：走 React 19 的 <style href + precedence> 提升机制，按 href 去重、
 * 多实例只注入一次，且随最后一个组件卸载自动清理；不用 CSS 文件是为了
 * 让本动画与组件同源、不污染全局样式表。keyframes 用 translateX（相对条宽）
 * 实现"从左侧滑入、滑出右侧"的循环，轨道 overflow-hidden 负责裁切。
 */
const INDETERMINATE_ID = "mad-progress-indeterminate";

const INDETERMINATE_CSS = `
@keyframes ${INDETERMINATE_ID} {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}
.${INDETERMINATE_ID}-bar {
  animation: ${INDETERMINATE_ID} 1.4s ease-in-out infinite;
}
`;

/** 进度条指示色（语义 token），默认品牌蓝 */
const INDICATOR_COLOR_CLASS = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/60"
} as const;

export interface ProgressProps {
  /** 当前进度 0-100（indeterminate 为 false 时生效） */
  value?: number;
  /** 不确定进度：条以 1/3 宽度循环流动 */
  indeterminate?: boolean;
  /** 指示条语义色（任务状态：成功绿/警告橙/失败红） */
  color?: keyof typeof INDICATOR_COLOR_CLASS;
  /** 无障碍名称（progressbar role 要求可区分，WCAG 4.1.2） */
  "aria-label"?: string;
  className?: string;
}

export function Progress({
  value = 0,
  indeterminate = false,
  color = "primary",
  className,
  ...props
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value || 0));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : clamped}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    >
      {indeterminate && (
        <style href={INDETERMINATE_ID} precedence="default">
          {INDETERMINATE_CSS}
        </style>
      )}
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          INDICATOR_COLOR_CLASS[color],
          indeterminate && `w-1/3 ${INDETERMINATE_ID}-bar`
        )}
        style={indeterminate ? undefined : { width: `${clamped}%` }}
      />
    </div>
  );
}
