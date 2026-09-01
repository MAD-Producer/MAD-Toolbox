import { Badge, Box, Card, Stack } from "@mantine/core";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { t } from "../../locale";
import { SettingsSection } from "../../components/common/SettingsSection";
import { BilibiliAdvancedFields } from "./BilibiliAdvancedFields";
import { BilibiliCommandPanel } from "./BilibiliCommandPanel";
import { BilibiliDownloadFields } from "./BilibiliDownloadFields";
import { BilibiliLoginDialog } from "./BilibiliLoginDialog";
import { BilibiliPageHeader } from "./BilibiliPageHeader";
import { useBilibiliWorkspace, type BilibiliPageProps } from "./useBilibiliWorkspace";

export function BilibiliPage(props: BilibiliPageProps) {
  const workspace = useBilibiliWorkspace(props);

  return (
    <Box mih="100%">
      <Stack gap="md" p="lg">
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
          icon={<IconAdjustmentsHorizontal size={20} stroke={1.8} />}
          title={t("bilibili.advanced.title")}
          action={
            workspace.expertMode ? (
              <Badge size="xs" variant="light" color="orange">
                {t("bilibili.command.expertBadge")}
              </Badge>
            ) : null
          }
          opened={workspace.advancedOpen}
          onToggle={workspace.toggleAdvanced}
        >
          <Stack gap="md">
            <Card withBorder padding="md" radius="md">
              <BilibiliCommandPanel
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
          </Stack>
        </SettingsSection>
      </Stack>

      <BilibiliLoginDialog
        active={workspace.active}
        qrDataUrl={workspace.loginQr}
        onClose={workspace.dismissLoginQr}
      />
    </Box>
  );
}
