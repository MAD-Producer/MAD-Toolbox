import { SegmentedControl, Stack, Text } from "@mantine/core";
import { notifications } from "../../lib/notifications";
import { DependencyInstallCards } from "../../components/common/DependencyInstallCards";
import { DependencyStatusPanel } from "../../components/common/DependencyStatusPanel";
import type { DependencyStatus } from "../../contracts/dependency";
import { isWindows } from "../../lib/platform";
import { installDependency, type AppSettings } from "./api";

interface DependenciesSettingsPageProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<AppSettings>;
  dependencies: DependencyStatus[];
  loading: boolean;
  distributionMode: "Lite" | "Full";
  onRefresh: () => void;
}

export function DependenciesSettingsPage({
  settings,
  onSave,
  dependencies,
  loading,
  distributionMode,
  onRefresh
}: DependenciesSettingsPageProps) {
  const changePreference = async (value: string) => {
    const preference = value as AppSettings["dependencyPreference"];
    if (preference === settings.dependencyPreference) return;
    try {
      await onSave({ ...settings, dependencyPreference: preference });
      onRefresh();
    } catch (error) {
      notifications.show({ message: `保存失败：${String(error)}`, color: "red" });
    }
  };

  const onInstall = async (dependency: DependencyStatus) => {
    try {
      await installDependency(dependency.tool);
      notifications.show({
        message: "已打开终端窗口执行安装，完成后将自动重新检测。",
        color: "blue"
      });
    } catch (error) {
      notifications.show({ message: `无法启动安装：${String(error)}`, color: "red" });
    }
  };

  return (
    <Stack gap="md">
      <div>
        <Text fw={500}>工具版本来源</Text>
        <Text size="xs" c="dimmed">
          找不到首选来源时自动回退到另一来源，切换后立即重新检测。
        </Text>
        <SegmentedControl
          mt="sm"
          w={320}
          radius="md"
          value={settings.dependencyPreference}
          onChange={(value) => void changePreference(value)}
          data={[
            { value: "bundled", label: "内置版本优先" },
            { value: "system", label: isWindows ? "系统版本优先" : "系统 / Homebrew 优先" }
          ]}
        />
      </div>
      <DependencyStatusPanel
        dependencies={dependencies}
        loading={loading}
        onRefresh={onRefresh}
        onInstall={(dependency) => void onInstall(dependency)}
      />
      <DependencyInstallCards dependencies={dependencies} />
    </Stack>
  );
}
