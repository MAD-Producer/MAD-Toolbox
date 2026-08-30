import { Button, Group } from "@mantine/core";
import { IconInfoCircle, IconListDetails, IconPlayerPlay } from "@tabler/icons-react";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";
import { HeaderActions, HeaderIconButton } from "../../components/layout/HeaderActions";
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
  return (
    <HeaderActions section="network">
      <Group gap="xs" wrap="nowrap">
        <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
        <HeaderIconButton
          label={formatsLabel}
          variant="default"
          loading={probing === "formats"}
          disabled={probeDisabled}
          onClick={() => void onProbe("formats")}
        >
          <IconListDetails size={20} />
        </HeaderIconButton>
        <HeaderIconButton
          label={metadataLabel}
          variant="default"
          loading={probing === "metadata"}
          disabled={probeDisabled}
          onClick={() => void onProbe("metadata")}
        >
          <IconInfoCircle size={20} />
        </HeaderIconButton>
        <Button
          size="compact-md"
          leftSection={<IconPlayerPlay size={16} />}
          loading={submitting}
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      </Group>
    </HeaderActions>
  );
}
