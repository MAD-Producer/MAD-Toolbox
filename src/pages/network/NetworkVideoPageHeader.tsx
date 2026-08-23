import { Button, Group, Title } from "@mantine/core";
import { IconInfoCircle, IconListDetails, IconPlayerPlay } from "@tabler/icons-react";
import type { ProbeKind } from "./api";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";
import { t } from "../../locale";

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
  return (
    <Group justify="space-between" wrap="nowrap">
      <Group gap="xs" wrap="nowrap">
        <Title order={3}>{t("network.title")}</Title>
        <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
      </Group>
      <Group gap="xs" wrap="nowrap">
        <Button
          leftSection={<IconPlayerPlay size={16} />}
          loading={submitting}
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          {t("network.submit")}
        </Button>
        <Button
          variant="default"
          leftSection={<IconListDetails size={16} />}
          loading={probing === "formats"}
          disabled={probeDisabled}
          onClick={() => void onProbe("formats")}
        >
          {t("network.probe.formatsButton")}
        </Button>
        <Button
          variant="default"
          leftSection={<IconInfoCircle size={16} />}
          loading={probing === "metadata"}
          disabled={probeDisabled}
          onClick={() => void onProbe("metadata")}
        >
          {t("network.probe.metadataButton")}
        </Button>
      </Group>
    </Group>
  );
}
