import type { CSSProperties, ReactNode } from "react";
import {
  IconAlertTriangleFilled,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconInfoCircleFilled
} from "@tabler/icons-react";
import { notifications as mantineNotifications } from "@mantine/notifications";
import type { NotificationData } from "@mantine/notifications";

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

const ICON_BY_TYPE: Record<NotificationType, ReactNode> = {
  success: <IconCircleCheckFilled size={20} />,
  warning: <IconAlertTriangleFilled size={20} />,
  error: <IconCircleXFilled size={20} />,
  info: <IconInfoCircleFilled size={20} />
};

const lifetimeStyle = (ms: number): CSSProperties =>
  ({ "--app-notification-lifetime": `${ms}ms` }) as unknown as CSSProperties;

export const notifications = {
  show(input: NotificationData) {
    const type = TYPE_BY_COLOR[input.color ?? "blue"] ?? "info";
    const requested = input.autoClose ?? AUTO_CLOSE_BY_TYPE[type];
    const duration: number | false = requested === true ? 4000 : requested;
    const timed = duration !== false;
    const typeClasses = [
      "app-notification",
      `app-notification--${type}`,
      timed ? "app-notification--timed" : undefined
    ]
      .filter(Boolean)
      .join(" ");
    const id = mantineNotifications.show({
      ...input,
      autoClose: false,
      icon: input.icon ?? ICON_BY_TYPE[type],
      classNames: {
        ...(typeof input.classNames === "object" ? input.classNames : undefined),
        root: [
          input.className,
          typeof input.classNames === "object" ? input.classNames.root : undefined,
          typeClasses
        ]
          .filter(Boolean)
          .join(" "),
        icon: "app-notification-icon",
        title: "app-notification-title",
        description: "app-notification-description"
      },
      style: timed
        ? ({
            ...(input.style as CSSProperties | undefined),
            ...lifetimeStyle(duration)
          } as CSSProperties)
        : input.style
    });
    if (timed) window.setTimeout(() => mantineNotifications.hide(id), duration);
    return id;
  }
};
