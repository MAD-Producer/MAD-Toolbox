import { Badge, Button, Group, Stack, Text, Title } from "@mantine/core";
import { IconInfoCircle, IconPlayerPlay } from "@tabler/icons-react";
import type { MediaPageId } from "../../app/route";
import { MEDIA_L2_NAVIGATION } from "../../app/navigation";
import { useMediaWorkspace, type MediaWorkspacePageProps } from "./useMediaWorkspace";
import { CollapsibleSection } from "../../components/common/CollapsibleSection";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";
import { L2TabNav } from "../../components/common/L2TabNav";
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
import { MediaTaskOptions } from "./MediaTaskOptions";
import { MediaTimeRangeFields } from "./MediaTimeRangeFields";
import { t } from "../../locale";

interface MediaWorkspaceProps extends MediaWorkspacePageProps {
  page: MediaPageId;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

/**
 * 媒体工作流区（单一常驻工作区）：通栏页签导航（L2TabNav）位于标题行与拖拽区之间，
 * 为常驻单实例，切换工作流时激活段平滑淡入淡出；
 * 表单草稿由 useMediaWorkspace 在 page 变化时于渲染期重置。
 */
export function MediaWorkspace({
  page,
  onNavigatePage,
  dependencyLabels,
  onOpenDependencies,
  ...pageProps
}: MediaWorkspaceProps) {
  const workspace = useMediaWorkspace({ page, ...pageProps });

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Title order={3}>{t("nav.media")}</Title>
          <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Button
            leftSection={<IconPlayerPlay size={16} />}
            onClick={() => void workspace.submit()}
            loading={workspace.submitting}
            disabled={workspace.expertMode ? false : workspace.inputs.length === 0}
          >
            {t("media.submit")}
          </Button>
          <Button
            variant="default"
            leftSection={<IconInfoCircle size={16} />}
            disabled={!workspace.firstInput}
            onClick={() => void workspace.inspectFirst()}
          >
            {t("media.inspectFirst")}
          </Button>
        </Group>
      </Group>

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
        <MediaFileList inputs={workspace.inputs} onRemove={workspace.removeInput} />
      )}

      <Stack gap="sm">
        <MediaOperationSelector
          operations={workspace.operations}
          value={workspace.operation}
          disabled={workspace.expertMode}
          onChange={workspace.setOperation}
        />
        <OutputDirectoryField
          value={workspace.form.outputDirectory}
          disabled={workspace.expertMode}
          placeholder={t("media.outputToSourceHint")}
          onChange={(outputDirectory) => workspace.update({ outputDirectory })}
          onBrowse={workspace.pickOutputDirectory}
        />

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

      {workspace.isPr ? (
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
      ) : (
        <CollapsibleSection
          title={
            <>
              <Text size="sm" fw={500}>
                {t("media.advancedTitle")}
              </Text>
              {workspace.expertMode && (
                <Badge size="xs" variant="light" color="orange">
                  {t("media.expertModeBadge")}
                </Badge>
              )}
            </>
          }
          opened={workspace.advancedOpen}
          onToggle={workspace.toggleAdvanced}
        >
          <Stack gap="sm">
            <MediaCommandPanel
              isPr={false}
              expertMode={workspace.expertMode}
              expertText={workspace.expertText}
              preview={workspace.preview}
              previewError={workspace.previewError}
              onEnterExpert={workspace.enterExpert}
              onExitExpert={() => workspace.setExpertText(null)}
              onExpertTextChange={workspace.setExpertText}
              withDivider
            />
            {!workspace.expertMode && (
              <MediaAdvancedFields form={workspace.form} onUpdate={workspace.update} />
            )}
          </Stack>
        </CollapsibleSection>
      )}

      <MediaInspectionDialog
        active={workspace.active}
        summary={workspace.inspection}
        onClose={() => workspace.setInspection(null)}
      />
    </Stack>
  );
}
