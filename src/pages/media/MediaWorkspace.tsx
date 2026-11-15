import { SlidersHorizontal, Info, Play } from "@phosphor-icons/react";
import { useId, useRef } from "react";
import type { MediaPageId } from "../../app/route";
import { MEDIA_L2_NAVIGATION } from "../../app/navigation";
import { useMediaWorkspace, type MediaWorkspacePageProps } from "./useMediaWorkspace";
import { SettingsSection } from "../../components/common/SettingsSection";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";
import { L2TabNav } from "../../components/common/L2TabNav";
import { PageToolbar } from "../../components/common/PageToolbar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { IconButton } from "../../components/ui/icon-button";
import { Tooltip } from "../../components/ui/tooltip";
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
  dependencyLabels,
  onOpenDependencies,
  ...pageProps
}: MediaWorkspaceProps) {
  const workspace = useMediaWorkspace({ page, active, ...pageProps });
  const outputId = useId();
  const outputHintId = useId();
  const dropzoneWrapRef = useRef<HTMLDivElement>(null);

  // 文件清单删空后把焦点交回拖放区（D18 焦点管理模式）
  const focusDropzone = () =>
    dropzoneWrapRef.current?.querySelector<HTMLButtonElement>("button")?.focus();

  const commandPanel = (
    <MediaCommandPanel
      isPr={workspace.isPr}
      expertMode={workspace.expertMode}
      expertText={workspace.expertText}
      preview={workspace.preview}
      previewError={workspace.previewError}
      onEnterExpert={workspace.enterExpert}
      onExitExpert={() => workspace.setExpertText(null)}
      onExpertTextChange={workspace.setExpertText}
    />
  );

  return (
    <div className="flex min-h-full flex-col gap-4 p-5">
      {active && (
        <PageToolbar>
          <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
          <Tooltip label={t("media.inspectFirst")}>
            <span className="inline-flex">
              <IconButton
                label={t("media.inspectFirst")}
                variant="outline"
                size="sm"
                disabled={!workspace.firstInput}
                onClick={() => void workspace.inspectFirst()}
              >
                <Info size={16} />
              </IconButton>
            </span>
          </Tooltip>
          {workspace.expertMode || workspace.inputs.length > 0 ? (
            <Button
              size="sm"
              className="h-8 gap-1.5"
              leftSection={<Play size={16} />}
              onClick={() => void workspace.submit()}
              loading={workspace.submitting}
              disabled={workspace.expertMode ? false : workspace.inputs.length === 0}
            >
              {t("media.submit")}
            </Button>
          ) : (
            <Tooltip label={t("media.submit.needFiles")}>
              <span className="inline-flex">
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  leftSection={<Play size={16} />}
                  onClick={() => void workspace.submit()}
                  loading={workspace.submitting}
                  disabled
                >
                  {t("media.submit")}
                </Button>
              </span>
            </Tooltip>
          )}
        </PageToolbar>
      )}

      <L2TabNav
        items={MEDIA_L2_NAVIGATION.map(({ page: id, labelKey }) => ({
          page: id,
          label: t(labelKey)
        }))}
        value={page}
        onChange={workspace.switchPage}
        aria-label={t("media.workflowAria")}
      />

      <div ref={dropzoneWrapRef}>
        <MediaDropzone onPickFiles={workspace.addFiles} onDropPaths={workspace.addPaths} />
      </div>
      {workspace.inputs.length > 0 && (
        <div className="flex flex-col gap-2">
          <Badge variant="default" className="self-start">
            {t("media.fileCount", { count: workspace.inputs.length })}
          </Badge>
          <MediaFileList
            inputs={workspace.inputs}
            onRemove={workspace.removeInput}
            onEmptied={focusDropzone}
          />
        </div>
      )}

      <SettingsSection>
        <div className="flex flex-col gap-4">
          <MediaOperationSelector
            operations={workspace.operations}
            value={workspace.operation}
            disabled={workspace.expertMode}
            onChange={workspace.setOperation}
          />
          <FieldRow
            label={t("common.outputDirectory")}
            hint={t("media.outputToSourceHint")}
            htmlFor={outputId}
            hintId={outputHintId}
          >
            <OutputDirectoryField
              value={workspace.form.outputDirectory}
              disabled={workspace.expertMode}
              inputId={outputId}
              describedById={outputHintId}
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
        </div>
      </SettingsSection>

      {workspace.isPr ? (
        <Card padding="md">{commandPanel}</Card>
      ) : (
        <SettingsSection
          icon={<SlidersHorizontal size={20} />}
          title={t("media.advancedTitle")}
          action={
            workspace.expertMode ? (
              <Badge variant="warning">{t("media.expertModeBadge")}</Badge>
            ) : null
          }
          opened={workspace.advancedOpen}
          onToggle={workspace.toggleAdvanced}
        >
          <div className="flex flex-col gap-4">
            <Card padding="md">{commandPanel}</Card>
            {!workspace.expertMode && (
              <MediaAdvancedFields form={workspace.form} onUpdate={workspace.update} />
            )}
          </div>
        </SettingsSection>
      )}

      <MediaInspectionDialog
        active={workspace.active}
        summary={workspace.inspection}
        onClose={() => workspace.setInspection(null)}
      />
    </div>
  );
}
