import { SlidersHorizontal } from "@phosphor-icons/react";
import { Card } from "../../components/ui/card";
import { CommandPreview } from "../../components/common/CommandPreview";
import { SettingsSection } from "../../components/common/SettingsSection";
import { t } from "../../locale";
import { Aria2AdvancedFields } from "./Aria2AdvancedFields";
import { Aria2DownloadFields } from "./Aria2DownloadFields";
import { Aria2PageHeader } from "./Aria2PageHeader";
import { useAria2Workspace, type Aria2PageProps } from "./useAria2Workspace";

export function Aria2Page(props: Aria2PageProps) {
  const workspace = useAria2Workspace(props);

  return (
    <div className="min-h-full">
      <div className="flex flex-col gap-4 p-5">
        {props.active && (
          <Aria2PageHeader
            submitting={workspace.submitting}
            submitDisabled={!workspace.preview}
            onSubmit={() => void workspace.submit()}
            dependencyLabels={props.dependencyLabels}
            onOpenDependencies={props.onOpenDependencies}
          />
        )}

        <SettingsSection>
          <Aria2DownloadFields
            form={workspace.form}
            disabled={workspace.submitting}
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
          opened={workspace.advancedOpen}
          onToggle={workspace.toggleAdvanced}
        >
          <div className="flex flex-col gap-4">
            <Card padding="md">
              <CommandPreview
                display={workspace.preview?.display ?? null}
                error={workspace.previewError}
              />
            </Card>
            <Aria2AdvancedFields
              form={workspace.form}
              disabled={workspace.submitting}
              onUpdate={workspace.update}
              trackerInfo={workspace.trackerInfo}
              trackerLoading={workspace.trackerLoading}
              onRefreshTrackers={workspace.refreshTrackers}
            />
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
