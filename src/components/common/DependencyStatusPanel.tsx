import { useState } from "react";
import { ActionIcon, Badge, Button, Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconCircleCheck, IconDownload, IconRefresh } from "@tabler/icons-react";
import { isWindows, toolInstallCommands } from "../../lib/platform";
import type { DependencyStatus } from "../../contracts/dependency";
import { t } from "../../locale";
import { CollapsibleSection } from "./CollapsibleSection";
import { FieldWithActions } from "./FieldWithActions";

interface DependencyStatusPanelProps {
  dependencies: DependencyStatus[];
  loading: boolean;
  onRefresh: () => void;
  onInstall: (dependency: DependencyStatus) => void;
}

export function DependencyStatusPanel({
  dependencies,
  loading,
  onRefresh,
  onInstall
}: DependencyStatusPanelProps) {
  const [opened, setOpened] = useState(false);
  const missing = dependencies.filter((item) => item.required && !item.available);

  return (
    <CollapsibleSection
      opened={opened}
      onToggle={() => setOpened((value) => !value)}
      title={
        missing.length > 0 ? (
          <Badge variant="transparent" color="yellow">
            {t("deps.requiredMissingCount", { count: missing.length })}
          </Badge>
        ) : (
          <Badge variant="transparent" color="teal" leftSection={<IconCircleCheck size={12} />}>
            {t("deps.allReady")}
          </Badge>
        )
      }
      action={
        <Button
          size="compact-sm"
          variant="subtle"
          className="dep-refresh"
          leftSection={<IconRefresh size={14} />}
          loading={loading}
          onClick={onRefresh}
        >
          {t("deps.recheck")}
        </Button>
      }
    >
      <Stack gap="xs">
        {dependencies.map((dependency) => {
          const installable =
            !dependency.available && Boolean(toolInstallCommands[dependency.tool]);
          return (
            <FieldWithActions
              key={dependency.tool}
              align="stretch"
              actions={
                installable && (
                  <Tooltip
                    label={t("deps.installTooltip", {
                      manager: isWindows ? "winget" : "Homebrew"
                    })}
                    position="top"
                  >
                    <ActionIcon
                      variant="light"
                      color="teal"
                      radius="md"
                      size="xl"
                      style={{ height: "auto" }}
                      aria-label={t("deps.installAria", { name: dependency.label })}
                      onClick={() => onInstall(dependency)}
                    >
                      <IconDownload size={18} />
                    </ActionIcon>
                  </Tooltip>
                )
              }
            >
              <Card withBorder radius="calc(var(--mantine-radius-md) + 4px)" padding="sm">
                <Stack gap={2}>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={600}>
                        {dependency.label}
                      </Text>
                      {!dependency.required && (
                        <Badge
                          size="xs"
                          variant="transparent"
                          color="gray"
                          style={{ flexShrink: 0 }}
                        >
                          {t("deps.optionalBadge")}
                        </Badge>
                      )}
                    </Group>
                    <Badge
                      color={dependency.available ? "teal" : "yellow"}
                      variant="transparent"
                      style={{ flexShrink: 0 }}
                    >
                      {dependency.available
                        ? dependency.source === "bundled"
                          ? t("deps.bundled")
                          : t("deps.system")
                        : dependency.healthCheckFailed
                          ? t("deps.environmentBroken")
                          : t("deps.notReady")}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" truncate>
                    {dependency.available
                      ? (dependency.version ?? t("deps.versionUnknown"))
                      : dependency.healthCheckFailed
                        ? t("deps.musicdlEnvironmentBroken")
                        : t("deps.notInstalled")}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {dependency.available
                      ? (dependency.path ?? t("deps.pathUnknown"))
                      : (dependency.installHint ?? t("deps.noVersionFound"))}
                  </Text>
                </Stack>
              </Card>
            </FieldWithActions>
          );
        })}
      </Stack>
    </CollapsibleSection>
  );
}
