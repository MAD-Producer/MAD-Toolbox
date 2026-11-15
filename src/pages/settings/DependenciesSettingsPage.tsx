import { IconAlertTriangle } from "@tabler/icons-react";
import { useState } from "react";
import { notifications } from "../../lib/notifications";
import { DependencyStatusPanel } from "../../components/common/DependencyStatusPanel";
import { Segmented } from "../../components/ui/segmented";
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
  mirrorQueue: ToolName[];
  onMirrorInstall: (tools: ToolName[]) => Promise<void>;
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
  mirrorQueue,
  onMirrorInstall
}: DependenciesSettingsPageProps) {
  const [preference, setPreference] = useState(settings.dependencyPreference);
  const [changingPreference, setChangingPreference] = useState(false);

  // 乐观更新 + 失败就地回滚（原先靠 Effect 在 changingPreference 复位时把
  // settings.dependencyPreference 镜像回本地，保存路径是唯一写入方，等价且更直接）
  const changePreference = async (value: string) => {
    const nextPreference = value as AppSettings["dependencyPreference"];
    if (changingPreference || nextPreference === preference) return;
    const previous = preference;
    setPreference(nextPreference);
    setChangingPreference(true);
    try {
      await onSave(nextPreference);
      onRefresh();
    } catch (error) {
      setPreference(previous);
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
    <div className="flex flex-col gap-4">
      <SettingsSectionCard>
        <SettingsRow
          title={t("settings.deps.sourceTitle")}
          description={t("settings.deps.sourceHint")}
        >
          <Segmented
            aria-label={t("settings.deps.sourceTitle")}
            value={preference}
            disabled={changingPreference}
            onChange={(value) => void changePreference(value)}
            options={[
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
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-2.5">
          <IconAlertTriangle size={16} stroke={1.8} className="mt-0.5 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("deps.mirrorCheckFailed")}</p>
            <p className="mt-0.5 text-xs text-foreground">{mirrorError}</p>
          </div>
        </div>
      )}
      <DependencyStatusPanel
        dependencies={dependencies}
        loading={loading || loadingMirror}
        onRefresh={onRefresh}
        onInstall={(dependency) => void onInstall(dependency)}
        mirrorDependencies={mirrorDependencies}
        installation={mirrorInstallation}
        queue={mirrorQueue}
        onMirrorInstall={(tools) => void onMirrorInstall(tools)}
      />
    </div>
  );
}
