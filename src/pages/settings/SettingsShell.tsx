import { Stack } from "@mantine/core";
import type { ReactNode } from "react";
import { SETTINGS_L2_NAVIGATION } from "../../app/navigation";
import type { SettingsPageId } from "../../app/route";
import { L2TabNav } from "../../components/common/L2TabNav";
import { t } from "../../locale";

interface SettingsShellProps {
  page: SettingsPageId;
  onNavigatePage: (page: SettingsPageId) => void;
  /** 必要依赖缺失数：>0 时在「依赖」页签挂黄色角标（与顶栏设置入口同语言） */
  missingDependencies?: number;
  children: ReactNode;
}

/**
 * 设置区框架：顶栏由 AppShell 切换为「返回 + 设置」页头（主导航不出现），
 * 区内为通栏页签导航 + 单列内容；Shell 常驻不随子页重挂载，激活段平滑淡入淡出。
 */
export function SettingsShell({
  page,
  onNavigatePage,
  missingDependencies,
  children
}: SettingsShellProps) {
  return (
    <Stack gap="lg" p="md">
      <L2TabNav
        items={SETTINGS_L2_NAVIGATION.map(({ page: id, labelKey }) => ({
          page: id,
          label: t(labelKey)
        }))}
        value={page}
        onChange={onNavigatePage}
        badges={
          missingDependencies && missingDependencies > 0
            ? { dependencies: missingDependencies }
            : undefined
        }
        aria-label={t("settings.shell.sectionAria")}
      />
      {children}
    </Stack>
  );
}
