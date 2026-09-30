import { useEffect, useState } from "react";
import { ActionIcon, Badge, Button, Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconCircleCheck, IconDownload, IconRefresh } from "@tabler/icons-react";
import type { DependencyStatus, ToolName } from "../../contracts/dependency";
import { t, type TranslationKey } from "../../locale";
import { CollapsibleSection } from "./CollapsibleSection";
import { FieldWithActions } from "./FieldWithActions";

const TOOL_PURPOSES: Record<ToolName, TranslationKey> = {
  bbdown: "deps.purpose.bbdown",
  "yt-dlp": "deps.purpose.ytDlp",
  deno: "deps.purpose.deno",
  ffmpeg: "deps.purpose.ffmpeg",
  ffprobe: "deps.purpose.ffprobe",
  mediainfo: "deps.purpose.mediainfo",
  musicdl: "deps.purpose.musicdl",
  python: "deps.purpose.python"
};

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
  const missing = dependencies.filter((item) => !item.available);
  const missingTools = missing.map((item) => item.tool).join(",");
  const [opened, setOpened] = useState(missing.length > 0);
  const sortedDependencies = [...missing, ...dependencies.filter((item) => item.available)];

  useEffect(() => {
    if (missingTools) setOpened(true);
  }, [missingTools]);

  return (
    <CollapsibleSection
      opened={opened}
      onToggle={() => setOpened((value) => !value)}
      title={
        dependencies.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("deps.checking")}
          </Text>
        ) : missing.length > 0 ? (
          <Badge variant="transparent" color="yellow">
            {t("deps.missingCount", { count: missing.length })}
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
          onClick={() => {
            if (missing.length > 0) setOpened(true);
            onRefresh();
          }}
        >
          {t("deps.recheck")}
        </Button>
      }
    >
      <Stack gap="xs">
        {sortedDependencies.map((dependency) => {
          const installable = !dependency.available && Boolean(dependency.installCommand);
          return (
            <FieldWithActions
              key={dependency.tool}
              align="stretch"
              actions={
                installable && (
                  <Tooltip
                    label={dependency.healthCheckFailed ? t("deps.repair") : t("deps.install")}
                    position="top"
                  >
                    <ActionIcon
                      variant="light"
                      color="teal"
                      radius="md"
                      size="xl"
                      style={{ height: "auto" }}
                      aria-label={t(
                        dependency.healthCheckFailed ? "deps.repairAria" : "deps.installAria",
                        { name: dependency.label }
                      )}
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
                    <Text size="sm" fw={600}>
                      {dependency.label}
                    </Text>
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
                  <Text size="xs" c="dimmed">
                    {t(TOOL_PURPOSES[dependency.tool])}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {dependency.available
                      ? (dependency.version ?? t("deps.versionUnknown"))
                      : dependency.healthCheckFailed
                        ? t("deps.musicdlEnvironmentBroken")
                        : t("deps.notInstalled")}
                  </Text>
                  <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>
                    {dependency.available
                      ? (dependency.path ?? t("deps.pathUnknown"))
                      : (dependency.installHint ?? t("deps.noVersionFound"))}
                  </Text>
                  {dependency.healthCheckError && (
                    <Text
                      size="xs"
                      c="red"
                      style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                    >
                      {dependency.healthCheckError}
                    </Text>
                  )}
                </Stack>
              </Card>
            </FieldWithActions>
          );
        })}
      </Stack>
    </CollapsibleSection>
  );
}
