import { SlidersHorizontal } from "@phosphor-icons/react";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { ExpertCommandPanel } from "../../components/common/ExpertCommandPanel";
import { SettingsSection } from "../../components/common/SettingsSection";
import { t } from "../../locale";
import { Aria2AdvancedFields } from "./Aria2AdvancedFields";
import { Aria2DownloadFields } from "./Aria2DownloadFields";
import { Aria2PageHeader } from "./Aria2PageHeader";
import { useAria2Workspace, type Aria2PageProps } from "./useAria2Workspace";

const COMMAND_LABELS = {
  previewTitle: "aria2.command.previewTitle",
  expertTitle: "aria2.command.expertTitle",
  restoreForm: "aria2.command.restoreForm",
  editCommand: "aria2.command.edit",
  expertWarning: "aria2.command.expertHint"
} as const;

export function Aria2Page(props: Aria2PageProps) {
  const workspace = useAria2Workspace(props);

  return (
    <div className="min-h-full">
      <div className="flex flex-col gap-4 p-5">
        {props.active && (
          <Aria2PageHeader
            submitting={workspace.submitting}
            submitDisabled={!workspace.expertMode && !workspace.preview}
            onSubmit={() => void workspace.submit()}
            dependencyLabels={props.dependencyLabels}
            onOpenDependencies={props.onOpenDependencies}
          />
        )}

        <SettingsSection>
          <Aria2DownloadFields
            form={workspace.form}
            disabled={workspace.expertMode}
            onUpdate={workspace.update}
            onPickOutputDirectory={workspace.pickOutputDirectory}
            onPickCookieFile={workspace.pickCookieFile}
            onPickTorrentFile={workspace.pickTorrentFile}
            cookieFiles={props.cookieFiles}
            onAddCookieFile={props.onAddCookieFile}
            globalProxy={props.globalProxy}
          />
        </SettingsSection>

        <SettingsSection
          icon={<SlidersHorizontal size={20} />}
          title={t("aria2.advanced")}
          action={
            workspace.expertMode ? <Badge variant="warning">{t("aria2.expertBadge")}</Badge> : null
          }
          opened={workspace.advancedOpen}
          onToggle={workspace.toggleAdvanced}
        >
          <div className="flex flex-col gap-4">
            <Card padding="md">
              <ExpertCommandPanel
                labels={COMMAND_LABELS}
                expertText={workspace.expertText}
                preview={workspace.preview}
                previewError={workspace.previewError}
                onEnterExpert={workspace.enterExpert}
                onExitExpert={() => workspace.setExpertText(null)}
                onExpertTextChange={workspace.setExpertText}
              />
            </Card>
            <Aria2AdvancedFields
              form={workspace.form}
              disabled={workspace.expertMode}
              onUpdate={workspace.update}
              trackerInfo={workspace.trackerInfo}
              trackerLoading={workspace.trackerLoading}
              onRefreshTrackers={workspace.refreshTrackers}
              onSelectTrackerSource={workspace.selectTrackerSource}
            />
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
