import { SegmentedControl, Stack, Text } from "@mantine/core";
import { notifications } from "../../lib/notifications";
import { DependencyInstallCards } from "../../components/common/DependencyInstallCards";
import { DependencyStatusPanel } from "../../components/common/DependencyStatusPanel";
import type { DependencyStatus } from "../../contracts/dependency";
import { isWindows } from "../../lib/platform";
import { t } from "../../locale";
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
      notifications.show({
        message: t("settings.saveFailed", { error: String(error) }),
        color: "red"
      });
    }
  };

  const onInstall = async (dependency: DependencyStatus) => {
    try {
      await installDependency(dependency.tool);
      notifications.show({
        message: t("settings.deps.installStarted"),
        color: "blue"
      });
    } catch (error) {
      notifications.show({
        message: t("settings.deps.installFailed", { error: String(error) }),
        color: "red"
      });
    }
  };

  return (
    <Stack gap="md">
      <div>
        <Text fw={500}>{t("settings.deps.sourceTitle")}</Text>
        <Text size="xs" c="dimmed">
          {t("settings.deps.sourceHint")}
        </Text>
        <SegmentedControl
          mt="sm"
          w={320}
          radius="md"
          value={settings.dependencyPreference}
          onChange={(value) => void changePreference(value)}
          data={[
            { value: "bundled", label: t("settings.deps.preferBundled") },
            {
              value: "system",
              label: isWindows
                ? t("settings.deps.preferSystemWindows")
                : t("settings.deps.preferSystemOther")
            }
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
