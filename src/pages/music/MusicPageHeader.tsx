import { Button, Group, Paper, Switch, Tooltip } from "@mantine/core";
import { IconMistOff, IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";
import { HeaderActions, headerTooltipProps } from "../../components/layout/HeaderActions";
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
  const runLabel = mode === "search" ? t("music.run.search") : t("music.mode.playlist");
  return (
    <HeaderActions section="music">
      <Group gap="xs" wrap="nowrap">
        <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
        <Tooltip {...headerTooltipProps} label={t("music.denoise.label")}>
          <Paper
            radius="md"
            withBorder
            px="xs"
            h={40}
            style={{ display: "flex", alignItems: "center" }}
          >
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
        {searching ? (
          <Button
            size="compact-md"
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
            size="compact-md"
            leftSection={<IconPlayerPlay size={16} />}
            loading={runLoading}
            disabled={runDisabled}
            onClick={onRun}
          >
            {runLabel}
          </Button>
        )}
      </Group>
    </HeaderActions>
  );
}
