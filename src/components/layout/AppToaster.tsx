import { Toaster } from "sonner";
import { useColorScheme } from "../../lib/theme";

/**
 * 应用级 Toaster：统一收敛 sonner 的全局配置（lib/notifications.tsx 的 per-toast 配置之外）。
 * - theme 跟随应用色彩主题（sonner 默认恒为 light，深色下会出现"白补丁"）
 * - 背景走 popover token，边框/文字同源，双主题自动适应
 * - closeButton：恢复旧版每条通知的可见关闭钮，且键盘可达（toast 本体不在 Tab 序列）
 * - visibleToasts=4：对齐旧 Mantine 通知的堆叠可见数
 * 已知限制：sonner 2.0.8 的 Toaster 不透传 closeButtonAriaLabel/containerAriaLabel，
 * 读屏播报固定英文（"Close toast"/"Notifications"），升级 sonner 后补中文。
 */
export function AppToaster() {
  const { resolvedColorScheme } = useColorScheme();
  return (
    <Toaster
      position="bottom-left"
      theme={resolvedColorScheme}
      visibleToasts={4}
      closeButton
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)"
        } as React.CSSProperties
      }
    />
  );
}
