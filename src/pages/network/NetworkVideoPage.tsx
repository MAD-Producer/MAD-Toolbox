import { Badge, Box, Card, Stack } from "@mantine/core";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { t } from "../../locale";
import { SettingsSection } from "../../components/common/SettingsSection";
import { NetworkVideoAdvancedFields } from "./NetworkVideoAdvancedFields";
import { NetworkVideoCommandPanel } from "./NetworkVideoCommandPanel";
import { NetworkVideoDownloadFields } from "./NetworkVideoDownloadFields";
import { NetworkVideoPageHeader } from "./NetworkVideoPageHeader";
import { NetworkVideoProbeDialog } from "./NetworkVideoProbeDialog";
import { useNetworkVideoWorkspace, type NetworkVideoPageProps } from "./useNetworkVideoWorkspace";

export function NetworkVideoPage(props: NetworkVideoPageProps) {
  const workspace = useNetworkVideoWorkspace(props);

  return (
    <Box mih="100%">
      <Stack gap="md" p="lg">
        {props.active && (
          <NetworkVideoPageHeader
            probing={workspace.probing}
            probeDisabled={!workspace.form.url.trim() || workspace.expertMode}
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
            globalProxy={props.globalProxy}
          />
        </SettingsSection>

        <SettingsSection
          icon={<IconAdjustmentsHorizontal size={20} stroke={1.8} />}
          title={t("network.advanced")}
          action={
            workspace.expertMode ? (
              <Badge size="xs" variant="light" color="orange">
                {t("network.expertBadge")}
              </Badge>
            ) : null
          }
          opened={workspace.advancedOpen}
          onToggle={workspace.toggleAdvanced}
        >
          <Stack gap="md">
            <Card withBorder padding="md" radius="md">
              <NetworkVideoCommandPanel
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
          </Stack>
        </SettingsSection>
      </Stack>

      <NetworkVideoProbeDialog
        active={workspace.active}
        result={workspace.probeResult}
        onClose={() => workspace.setProbeResult(null)}
      />
    </Box>
  );
}
