import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { t } from "../../locale";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { ExpertCommandPanel } from "../../components/common/ExpertCommandPanel";
import { SettingsSection } from "../../components/common/SettingsSection";
import { NetworkVideoAdvancedFields } from "./NetworkVideoAdvancedFields";
import { NetworkVideoDownloadFields } from "./NetworkVideoDownloadFields";
import { NetworkVideoPageHeader } from "./NetworkVideoPageHeader";
import { NetworkVideoProbeDialog } from "./NetworkVideoProbeDialog";
import { useNetworkVideoWorkspace, type NetworkVideoPageProps } from "./useNetworkVideoWorkspace";

const COMMAND_LABELS = {
  previewTitle: "network.command.previewTitle",
  expertTitle: "network.command.expertTitle",
  restoreForm: "network.command.restoreForm",
  editCommand: "network.command.edit",
  expertWarning: "network.command.expertHint"
} as const;

export function NetworkVideoPage(props: NetworkVideoPageProps) {
  const workspace = useNetworkVideoWorkspace(props);

  return (
    <div className="min-h-full">
      <div className="flex flex-col gap-4 p-5">
        {props.active && (
          <NetworkVideoPageHeader
            probing={workspace.probing}
            probeDisabled={
              !workspace.form.url.trim() || workspace.expertMode || workspace.probing !== null
            }
            submitting={workspace.submitting}
            submitDisabled={!workspace.expertMode && !workspace.preview}
            onSubmit={() => void workspace.submit()}
            onProbe={workspace.probe}
            dependencyLabels={props.dependencyLabels}
            onOpenDependencies={props.onOpenDependencies}
          />
        )}

        <SettingsSection>
          <NetworkVideoDownloadFields
            form={workspace.form}
            disabled={workspace.expertMode}
            onUpdate={workspace.update}
            onPickOutputDirectory={workspace.pickOutputDirectory}
            onPickCookieFile={workspace.pickCookieFile}
            onVerifyCookie={workspace.verifyCookie}
            cookieFiles={props.cookieFiles}
            onAddCookieFile={props.onAddCookieFile}
            cookieVerification={workspace.cookieVerification}
            verifyingCookie={workspace.verifyingCookie}
            globalProxy={props.globalProxy}
          />
        </SettingsSection>

        <SettingsSection
          icon={<IconAdjustmentsHorizontal size={20} stroke={1.8} />}
          title={t("network.advanced")}
          action={
            workspace.expertMode ? (
              <Badge variant="warning">{t("network.expertBadge")}</Badge>
            ) : null
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
            <NetworkVideoAdvancedFields
              form={workspace.form}
              disabled={workspace.expertMode}
              onUpdate={workspace.update}
            />
          </div>
        </SettingsSection>
      </div>

      <NetworkVideoProbeDialog
        active={workspace.active}
        result={workspace.probeResult}
        onClose={() => workspace.setProbeResult(null)}
      />
    </div>
  );
}
