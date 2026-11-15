import { SlidersHorizontal } from "@phosphor-icons/react";
import { t } from "../../locale";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { ExpertCommandPanel } from "../../components/common/ExpertCommandPanel";
import { SettingsSection } from "../../components/common/SettingsSection";
import { BilibiliAdvancedFields } from "./BilibiliAdvancedFields";
import { BilibiliDownloadFields } from "./BilibiliDownloadFields";
import { BilibiliLoginDialog } from "./BilibiliLoginDialog";
import { BilibiliPageHeader } from "./BilibiliPageHeader";
import { useBilibiliWorkspace, type BilibiliPageProps } from "./useBilibiliWorkspace";

const COMMAND_LABELS = {
  previewTitle: "bilibili.command.previewTitle",
  expertTitle: "bilibili.command.expertTitle",
  restoreForm: "bilibili.command.restoreForm",
  editCommand: "bilibili.command.editCommand",
  expertWarning: "bilibili.command.expertWarning"
} as const;

export function BilibiliPage(props: BilibiliPageProps) {
  const workspace = useBilibiliWorkspace(props);

  return (
    <div className="min-h-full">
      <div className="flex flex-col gap-4 p-5">
        {props.active && (
          <BilibiliPageHeader
            loginPhase={workspace.loginPhase}
            loggedIn={workspace.loginLoggedIn}
            submitting={workspace.submitting}
            submitDisabled={!workspace.expertMode && !workspace.preview}
            onSubmit={() => void workspace.submit()}
            onBeginLogin={workspace.beginLogin}
            onLogout={workspace.logoutLogin}
            dependencyLabels={props.dependencyLabels}
            onOpenDependencies={props.onOpenDependencies}
          />
        )}

        <SettingsSection>
          <BilibiliDownloadFields
            form={workspace.form}
            disabled={workspace.expertMode}
            onUpdate={workspace.update}
            onPickOutputDirectory={workspace.pickOutputDirectory}
          />
        </SettingsSection>

        <SettingsSection
          icon={<SlidersHorizontal size={20} />}
          title={t("bilibili.advanced.title")}
          action={
            workspace.expertMode ? (
              <Badge variant="warning">{t("bilibili.command.expertBadge")}</Badge>
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
            <BilibiliAdvancedFields
              form={workspace.form}
              disabled={workspace.expertMode}
              onUpdate={workspace.update}
            />
          </div>
        </SettingsSection>
      </div>

      <BilibiliLoginDialog
        active={workspace.active}
        qrDataUrl={workspace.loginQr}
        onClose={workspace.dismissLoginQr}
      />
    </div>
  );
}
