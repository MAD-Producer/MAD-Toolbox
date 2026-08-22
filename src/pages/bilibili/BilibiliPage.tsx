import { Badge, Stack, Text } from "@mantine/core";
import { t } from "../../locale";
import { BilibiliAdvancedFields } from "./BilibiliAdvancedFields";
import { BilibiliCommandPanel } from "./BilibiliCommandPanel";
import { BilibiliDownloadFields } from "./BilibiliDownloadFields";
import { BilibiliLoginDialog } from "./BilibiliLoginDialog";
import { BilibiliPageHeader } from "./BilibiliPageHeader";
import { CollapsibleSection } from "../../components/common/CollapsibleSection";
import { useBilibiliWorkspace, type BilibiliPageProps } from "./useBilibiliWorkspace";

export function BilibiliPage(props: BilibiliPageProps) {
  const workspace = useBilibiliWorkspace(props);

  return (
    <Stack gap="md" p="md">
      <BilibiliPageHeader
        loginPhase={workspace.loginPhase}
        loggedIn={workspace.loginLoggedIn}
        submitting={workspace.submitting}
        submitDisabled={!workspace.expertMode && !workspace.preview}
        onSubmit={() => void workspace.submit()}
        onBeginLogin={workspace.beginLogin}
        dependencyLabels={props.dependencyLabels}
        onOpenDependencies={props.onOpenDependencies}
      />

      <Stack gap="sm">
        <BilibiliDownloadFields
          form={workspace.form}
          disabled={workspace.expertMode}
          onUpdate={workspace.update}
          onPickOutputDirectory={workspace.pickOutputDirectory}
        />
      </Stack>

      <CollapsibleSection
        title={
          <>
            <Text size="sm" fw={500}>
              {t("bilibili.advanced.title")}
            </Text>
            {workspace.expertMode && (
              <Badge size="xs" variant="light" color="orange">
                {t("bilibili.command.expertBadge")}
              </Badge>
            )}
          </>
        }
        opened={workspace.advancedOpen}
        onToggle={workspace.toggleAdvanced}
      >
        <Stack gap="sm">
          <BilibiliCommandPanel
            expertText={workspace.expertText}
            preview={workspace.preview}
            previewError={workspace.previewError}
            onEnterExpert={workspace.enterExpert}
            onExitExpert={() => workspace.setExpertText(null)}
            onExpertTextChange={workspace.setExpertText}
            withDivider
          />
          <BilibiliAdvancedFields
            form={workspace.form}
            disabled={workspace.expertMode}
            onUpdate={workspace.update}
          />
        </Stack>
      </CollapsibleSection>

      <BilibiliLoginDialog
        active={workspace.active}
        qrDataUrl={workspace.loginQr}
        onClose={workspace.dismissLoginQr}
      />
    </Stack>
  );
}
