import { Button, Group, Paper, Switch, Title, Tooltip } from "@mantine/core";
import { IconMistOff, IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";
import { t } from "../../locale";
import type { MusicMode } from "./configuration";

interface MusicPageHeaderProps {
  mode: MusicMode;
  runLoading: boolean;
  runDisabled: boolean;
  onRun: () => void;
  searching: boolean;
  stopping: boolean;
  onStopSearch: () => void;
  denoise: boolean;
  onDenoiseChange: (value: boolean) => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

export function MusicPageHeader({
  mode,
  runLoading,
  runDisabled,
  onRun,
  searching,
  stopping,
  onStopSearch,
  denoise,
  onDenoiseChange,
  dependencyLabels,
  onOpenDependencies
}: MusicPageHeaderProps) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Group gap="xs" wrap="nowrap">
        <Title order={3}>{t("nav.music")}</Title>
        <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
        <Tooltip label={t("music.denoise.label")}>
          <Paper radius="md" withBorder px="xs" py={6}>
            <Group gap="xs" wrap="nowrap">
              <IconMistOff size={18} />
              <Switch
                size="xs"
                checked={denoise}
                onChange={(event) => onDenoiseChange(event.currentTarget.checked)}
              />
            </Group>
          </Paper>
        </Tooltip>
      </Group>
      <Group gap="xs" wrap="nowrap">
        {searching ? (
          <Button
            color="red"
            variant="light"
            leftSection={<IconPlayerStop size={16} />}
            loading={stopping}
            onClick={onStopSearch}
          >
            {t("music.stopSearch")}
          </Button>
        ) : (
          <Button
            leftSection={<IconPlayerPlay size={16} />}
            loading={runLoading}
            disabled={runDisabled}
            onClick={onRun}
          >
            {mode === "search" ? t("music.run.search") : t("music.mode.playlist")}
          </Button>
        )}
      </Group>
    </Group>
  );
}
