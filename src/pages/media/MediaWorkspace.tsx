import { Badge, Box, Button, Card, Group, Stack, Text } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconInfoCircle, IconPlayerPlay } from "@tabler/icons-react";
import type { MediaPageId } from "../../app/route";
import { MEDIA_L2_NAVIGATION } from "../../app/navigation";
import { useMediaWorkspace, type MediaWorkspacePageProps } from "./useMediaWorkspace";
import { SettingsSection } from "../../components/common/SettingsSection";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";
import { L2TabNav } from "../../components/common/L2TabNav";
import { HeaderActions, HeaderIconButton } from "../../components/layout/HeaderActions";
import { MediaAdvancedFields } from "./MediaAdvancedFields";
import { MediaCommandPanel } from "./MediaCommandPanel";
import { MediaDropzone } from "./MediaDropzone";
import { MediaEncodingFields } from "./MediaEncodingFields";
import { MediaExtractFields } from "./MediaExtractFields";
import { MediaFileList } from "./MediaFileList";
import { MediaGifFields } from "./MediaGifFields";
import { MediaInspectionDialog } from "./MediaInspectionDialog";
import { MediaOperationSelector } from "./MediaOperationSelector";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
import { FieldRow } from "../../components/common/FieldRow";
import { resolveDefaultOutputDirectory } from "../../lib/platform";
import { MediaTaskOptions } from "./MediaTaskOptions";
import { MediaTimeRangeFields } from "./MediaTimeRangeFields";
import { t } from "../../locale";

interface MediaWorkspaceProps extends MediaWorkspacePageProps {
  page: MediaPageId;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

export function MediaWorkspace({
  active,
  page,
  onNavigatePage,
  dependencyLabels,
  onOpenDependencies,
  ...pageProps
}: MediaWorkspaceProps) {
  const workspace = useMediaWorkspace({ page, active, ...pageProps });

  return (
    <Box mih="100%">
      <Stack gap="md" p="lg">
        {active && (
          <HeaderActions section="media">
            <Group gap="xs" wrap="nowrap">
              <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
              <HeaderIconButton
                label={t("media.inspectFirst")}
                variant="default"
                disabled={!workspace.firstInput}
                onClick={() => void workspace.inspectFirst()}
              >
                <IconInfoCircle size={20} />
              </HeaderIconButton>
              <Button
                size="compact-md"
                leftSection={<IconPlayerPlay size={16} />}
                onClick={() => void workspace.submit()}
                loading={workspace.submitting}
                disabled={workspace.expertMode ? false : workspace.inputs.length === 0}
              >
                {t("media.submit")}
              </Button>
            </Group>
          </HeaderActions>
        )}

        <L2TabNav
          items={MEDIA_L2_NAVIGATION.map(({ page: id, labelKey }) => ({
            page: id,
            label: t(labelKey)
          }))}
          value={page}
          onChange={(next) => onNavigatePage?.(next)}
          aria-label={t("media.workflowAria")}
        />

        <MediaDropzone onPickFiles={workspace.addFiles} onDropPaths={workspace.addPaths} />
        {workspace.inputs.length > 0 && (
          <Stack gap="xs">
            <Badge variant="light" color="gray" style={{ alignSelf: "flex-start" }}>
              {t("media.fileCount", { count: workspace.inputs.length })}
            </Badge>
            <MediaFileList inputs={workspace.inputs} onRemove={workspace.removeInput} />
          </Stack>
        )}

        <SettingsSection>
          <Stack gap="md">
            <MediaOperationSelector
              operations={workspace.operations}
              value={workspace.operation}
              disabled={workspace.expertMode}
              onChange={workspace.setOperation}
            />
            <FieldRow label={t("common.outputDirectory")} hint={t("media.outputToSourceHint")}>
              <OutputDirectoryField
                bare
                value={workspace.form.outputDirectory}
                disabled={workspace.expertMode}
                onChange={(outputDirectory) => workspace.update({ outputDirectory })}
                onBrowse={workspace.pickOutputDirectory}
                resolveDefault={resolveDefaultOutputDirectory}
              />
            </FieldRow>

            {!workspace.isPr && (
              <>
                <MediaEncodingFields
                  operation={workspace.operation}
                  form={workspace.form}
                  containers={workspace.containers}
                  videoCodecs={workspace.availableVideoCodecs}
                  audioCodecs={workspace.availableAudioCodecs}
                  disabled={workspace.expertMode}
                  onUpdate={workspace.update}
                />
                <MediaTimeRangeFields
                  form={workspace.form}
                  disabled={workspace.expertMode}
                  onUpdate={workspace.update}
                />
                <MediaGifFields
                  operation={workspace.operation}
                  form={workspace.form}
                  disabled={workspace.expertMode}
                  onUpdate={workspace.update}
                />
                <MediaExtractFields
                  operation={workspace.operation}
                  form={workspace.form}
                  disabled={workspace.expertMode}
                  onUpdate={workspace.update}
                />
                <MediaTaskOptions
                  form={workspace.form}
                  disabled={workspace.expertMode}
                  onUpdate={workspace.update}
                />
              </>
            )}
          </Stack>
        </SettingsSection>

        {workspace.isPr ? (
          <Card withBorder padding="md" radius="md">
            <MediaCommandPanel
              isPr
              expertMode={workspace.expertMode}
              expertText={workspace.expertText}
              preview={workspace.preview}
              previewError={workspace.previewError}
              onEnterExpert={workspace.enterExpert}
              onExitExpert={() => workspace.setExpertText(null)}
              onExpertTextChange={workspace.setExpertText}
            />
          </Card>
        ) : (
          <SettingsSection
            icon={<IconAdjustmentsHorizontal size={20} stroke={1.8} />}
            title={t("media.advancedTitle")}
            action={
              workspace.expertMode ? (
                <Badge size="xs" variant="light" color="orange">
                  {t("media.expertModeBadge")}
                </Badge>
              ) : null
            }
            opened={workspace.advancedOpen}
            onToggle={workspace.toggleAdvanced}
          >
            <Stack gap="md">
              <Card withBorder padding="md" radius="md">
                <MediaCommandPanel
                  isPr={false}
                  expertMode={workspace.expertMode}
                  expertText={workspace.expertText}
                  preview={workspace.preview}
                  previewError={workspace.previewError}
                  onEnterExpert={workspace.enterExpert}
                  onExitExpert={() => workspace.setExpertText(null)}
                  onExpertTextChange={workspace.setExpertText}
                />
              </Card>
              {!workspace.expertMode && (
                <MediaAdvancedFields form={workspace.form} onUpdate={workspace.update} />
              )}
            </Stack>
          </SettingsSection>
        )}

        <MediaInspectionDialog
          active={workspace.active}
          summary={workspace.inspection}
          onClose={() => workspace.setInspection(null)}
        />
      </Stack>
    </Box>
  );
}
