import { Alert, SegmentedControl, Stack } from "@mantine/core";
import { useEffect, useState } from "react";
import { notifications } from "../../lib/notifications";
import { DependencyStatusPanel } from "../../components/common/DependencyStatusPanel";
import type {
  DependencyDownloadProgress,
  DependencyStatus,
  MirrorDependencyStatus,
  ToolName
} from "../../contracts/dependency";
import { isWindows } from "../../lib/platform";
import { t } from "../../locale";
import { installDependency, type AppSettings } from "./api";
import { SettingsRow, SettingsSectionCard } from "./SettingsBlocks";

interface DependenciesSettingsPageProps {
  settings: AppSettings;
  onSave: (preference: AppSettings["dependencyPreference"]) => Promise<AppSettings>;
  dependencies: DependencyStatus[];
  loading: boolean;
  onRefresh: () => void;
  mirrorDependencies: MirrorDependencyStatus[];
  loadingMirror: boolean;
  mirrorError: string | null;
  mirrorInstallation: DependencyDownloadProgress | null;
  onMirrorInstall: (tool: ToolName) => Promise<void>;
}

export function DependenciesSettingsPage({
  settings,
  onSave,
  dependencies,
  loading,
  onRefresh,
  mirrorDependencies,
  loadingMirror,
  mirrorError,
  mirrorInstallation,
  onMirrorInstall
}: DependenciesSettingsPageProps) {
  const [preference, setPreference] = useState(settings.dependencyPreference);
  const [changingPreference, setChangingPreference] = useState(false);

  useEffect(() => {
    if (!changingPreference) setPreference(settings.dependencyPreference);
  }, [settings.dependencyPreference, changingPreference]);

  const changePreference = async (value: string) => {
    const nextPreference = value as AppSettings["dependencyPreference"];
    if (changingPreference || nextPreference === preference) return;
    setPreference(nextPreference);
    setChangingPreference(true);
    try {
      await onSave(nextPreference);
      onRefresh();
    } catch (error) {
      notifications.show({
        message: t("settings.saveFailed", { error: String(error) }),
        color: "red"
      });
    } finally {
      setChangingPreference(false);
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
    <Stack gap="lg">
      <SettingsSectionCard>
        <SettingsRow
          title={t("settings.deps.sourceTitle")}
          description={t("settings.deps.sourceHint")}
        >
          <SegmentedControl
            radius="md"
            value={preference}
            disabled={changingPreference}
            onChange={(value) => void changePreference(value)}
            data={[
              { value: "managed", label: t("settings.deps.preferManaged") },
              {
                value: "system",
                label: isWindows
                  ? t("settings.deps.preferSystemWindows")
                  : t("settings.deps.preferSystemOther")
              }
            ]}
          />
        </SettingsRow>
      </SettingsSectionCard>
      {mirrorError && (
        <Alert color="yellow" title={t("deps.mirrorCheckFailed")}>
          {mirrorError}
        </Alert>
      )}
      <DependencyStatusPanel
        dependencies={dependencies}
        loading={loading || loadingMirror}
        onRefresh={onRefresh}
        onInstall={(dependency) => void onInstall(dependency)}
        mirrorDependencies={mirrorDependencies}
        installation={mirrorInstallation}
        onMirrorInstall={(tool) => void onMirrorInstall(tool)}
      />
    </Stack>
  );
}
