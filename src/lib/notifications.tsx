import type { CSSProperties, ReactNode } from "react";
import { toast } from "sonner";
import { Warning, CheckCircle, XCircle, Info } from "@phosphor-icons/react";

/**
 * 通知适配层：对外保持既有 `notifications.show({ color, title, message, ... })` API，
 * 内部转发到 sonner。13 处既有调用点零改动。
 * color 语义名（green/teal/yellow/red/blue）沿用旧 Mantine 词汇，映射到四种通知类型。
 *
 * 与旧 Mantine 实现的有意差异（保持旧 API 语义的部分不在此列）：
 * - icon 按类型着语义色（success/warning/error/info token），保持旧版"一眼分级别"的可扫读性
 * - 左侧 2px 语义色边条对应旧版的类型 tinted 底
 * - autoClose 按类型差异化（success 3s/warning 5s/error 10s/info 4s）沿用旧版 AUTO_CLOSE_BY_TYPE
 * - 自绘剩余时长进度条不再复刻（sonner 自带关闭倒计时外观）
 * - onClose 仅在手动关闭时触发（sonner onDismiss）；自动关闭不回调，旧 Mantine 的自动关闭回调无调用方
 */
export interface NotificationData {
  color?: string;
  title?: ReactNode;
  message?: ReactNode;
  autoClose?: boolean | number;
  icon?: ReactNode;
  id?: string | number;
  onClose?: () => void;
  style?: CSSProperties;
  className?: string;
}

type NotificationType = "success" | "warning" | "error" | "info";

const TYPE_BY_COLOR: Record<string, NotificationType> = {
  green: "success",
  teal: "success",
  yellow: "warning",
  red: "error",
  blue: "info"
};

const AUTO_CLOSE_BY_TYPE: Record<NotificationType, number> = {
  success: 3000,
  warning: 5000,
  error: 10000,
  info: 4000
};

const ICON_COLOR_BY_TYPE: Record<NotificationType, CSSProperties> = {
  success: { color: "var(--success)" },
  warning: { color: "var(--warning)" },
  error: { color: "var(--destructive)" },
  info: { color: "var(--info)" }
};

const ICON_BY_TYPE: Record<NotificationType, ReactNode> = {
  success: <CheckCircle size={20} weight="fill" style={ICON_COLOR_BY_TYPE.success} />,
  warning: <Warning size={20} weight="fill" style={ICON_COLOR_BY_TYPE.warning} />,
  error: <XCircle size={20} weight="fill" style={ICON_COLOR_BY_TYPE.error} />,
  info: <Info size={20} weight="fill" style={ICON_COLOR_BY_TYPE.info} />
};

const BORDER_COLOR_BY_TYPE: Record<NotificationType, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  error: "var(--destructive)",
  info: "var(--info)"
};

const TOAST_BY_TYPE: Record<NotificationType, (typeof toast)["success"]> = {
  success: toast.success,
  warning: toast.warning,
  error: toast.error,
  info: toast.info
};

export const notifications = {
  show(input: NotificationData): string | number {
    const type = TYPE_BY_COLOR[input.color ?? "blue"] ?? "info";
    const requested = input.autoClose ?? AUTO_CLOSE_BY_TYPE[type];
    // 旧 API 语义：true → 4000ms；数字 → 毫秒；false → 不自动关闭（sonner 用 Infinity）
    const duration =
      requested === true ? 4000 : requested === false ? Number.POSITIVE_INFINITY : requested;
    return TOAST_BY_TYPE[type](input.title as string, {
      description: input.message as string | undefined,
      duration,
      icon: input.icon ?? ICON_BY_TYPE[type],
      id: input.id,
      onDismiss: input.onClose,
      style: input.icon
        ? input.style
        : {
            // 类型语义色边条（2px 左边）：与 icon 着色共同恢复旧版的级别可扫读性
            ...(input.style ?? {}),
            borderLeft: `2px solid ${BORDER_COLOR_BY_TYPE[type]}`
          },
      className: input.className
    });
  },
  hide(id: string | number) {
    toast.dismiss(id);
  }
};
