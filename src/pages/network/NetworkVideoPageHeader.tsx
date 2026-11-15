import { IconInfoCircle, IconListDetails, IconPlayerPlay } from "@tabler/icons-react";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";
import { PageToolbar } from "../../components/common/PageToolbar";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Tooltip } from "../../components/ui/tooltip";
import { t } from "../../locale";
import type { ProbeKind } from "./api";

interface NetworkVideoPageHeaderProps {
  probing: ProbeKind | null;
  probeDisabled: boolean;
  submitting: boolean;
  submitDisabled: boolean;
  onSubmit: () => void;
  onProbe: (kind: ProbeKind) => Promise<void>;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

export function NetworkVideoPageHeader({
  probing,
  probeDisabled,
  submitting,
  submitDisabled,
  onSubmit,
  onProbe,
  dependencyLabels,
  onOpenDependencies
}: NetworkVideoPageHeaderProps) {
  const submitLabel = t("network.submit");
  const formatsLabel = t("network.probe.formatsButton");
  const metadataLabel = t("network.probe.metadataButton");

  const submitButton = (
    <Button
      size="sm"
      className="h-8 gap-1.5"
      leftSection={<IconPlayerPlay size={16} stroke={1.8} />}
      loading={submitting}
      disabled={submitDisabled}
      onClick={onSubmit}
    >
      {submitLabel}
    </Button>
  );

  return (
    <PageToolbar>
      <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
      <Tooltip label={probeDisabled ? t("network.probe.urlRequired") : formatsLabel}>
        <span className="inline-flex">
          <IconButton
            label={formatsLabel}
            variant="outline"
            size="sm"
            loading={probing === "formats"}
            disabled={probeDisabled}
            onClick={() => void onProbe("formats")}
          >
            <IconListDetails size={16} stroke={1.8} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip label={probeDisabled ? t("network.probe.urlRequired") : metadataLabel}>
        <span className="inline-flex">
          <IconButton
            label={metadataLabel}
            variant="outline"
            size="sm"
            loading={probing === "metadata"}
            disabled={probeDisabled}
            onClick={() => void onProbe("metadata")}
          >
            <IconInfoCircle size={16} stroke={1.8} />
          </IconButton>
        </span>
      </Tooltip>
      {submitDisabled && !submitting ? (
        <Tooltip label={t("common.submitWaitingPreview")}>
          <span className="inline-flex">{submitButton}</span>
        </Tooltip>
      ) : (
        submitButton
      )}
    </PageToolbar>
  );
}
