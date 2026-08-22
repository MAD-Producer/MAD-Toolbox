import { Badge, Stack, Text } from "@mantine/core";
import { CollapsibleSection } from "../../components/common/CollapsibleSection";
import { t } from "../../locale";
import { NetworkVideoAdvancedFields } from "./NetworkVideoAdvancedFields";
import { NetworkVideoCommandPanel } from "./NetworkVideoCommandPanel";
import { NetworkVideoDownloadFields } from "./NetworkVideoDownloadFields";
import { NetworkVideoPageHeader } from "./NetworkVideoPageHeader";
import { NetworkVideoProbeDialog } from "./NetworkVideoProbeDialog";
import { useNetworkVideoWorkspace, type NetworkVideoPageProps } from "./useNetworkVideoWorkspace";

export function NetworkVideoPage(props: NetworkVideoPageProps) {
  const workspace = useNetworkVideoWorkspace(props);

  return (
    <Stack gap="md" p="md">
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

      <Stack gap="sm">
        <NetworkVideoDownloadFields
          form={workspace.form}
          disabled={workspace.expertMode}
          onUpdate={workspace.update}
          onPickOutputDirectory={workspace.pickOutputDirectory}
          globalProxy={props.globalProxy}
        />
      </Stack>

      <CollapsibleSection
        title={
          <>
            <Text size="sm" fw={500}>
              {t("network.advanced")}
            </Text>
            {workspace.expertMode && (
              <Badge size="xs" variant="light" color="orange">
                {t("network.expertBadge")}
              </Badge>
            )}
          </>
        }
        opened={workspace.advancedOpen}
        onToggle={workspace.toggleAdvanced}
      >
        <Stack gap="sm">
          <NetworkVideoCommandPanel
            expertText={workspace.expertText}
            preview={workspace.preview}
            previewError={workspace.previewError}
            onEnterExpert={workspace.enterExpert}
            onExitExpert={() => workspace.setExpertText(null)}
            onExpertTextChange={workspace.setExpertText}
            withDivider
          />
          <NetworkVideoAdvancedFields
            form={workspace.form}
            disabled={workspace.expertMode}
            onUpdate={workspace.update}
          />
        </Stack>
      </CollapsibleSection>

      <NetworkVideoProbeDialog
        active={workspace.active}
        result={workspace.probeResult}
        onClose={() => workspace.setProbeResult(null)}
      />
    </Stack>
  );
}
