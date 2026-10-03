import { useEffect, useState } from "react";
import { Badge, Button, Card, Group, Progress, Stack, Text } from "@mantine/core";
import { IconCircleCheck, IconDownload, IconRefresh } from "@tabler/icons-react";
import type {
  DependencyDownloadProgress,
  DependencyStatus,
  MirrorDependencyStatus,
  ToolName
} from "../../contracts/dependency";
import { t, type TranslationKey } from "../../locale";
import { CollapsibleSection } from "./CollapsibleSection";

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
  mirrorDependencies: MirrorDependencyStatus[];
  installation: DependencyDownloadProgress | null;
  onMirrorInstall: (tool: ToolName) => void;
}

export function DependencyStatusPanel({
  dependencies,
  loading,
  onRefresh,
  onInstall,
  mirrorDependencies,
  installation,
  onMirrorInstall
}: DependencyStatusPanelProps) {
  const missing = dependencies.filter((item) => !item.available);
  const missingTools = missing.map((item) => item.tool).join(",");
  const [opened, setOpened] = useState(missing.length > 0);
  const sortedDependencies = [...missing, ...dependencies.filter((item) => item.available)];
  const mirrors = new Map(mirrorDependencies.map((dependency) => [dependency.tool, dependency]));
  const updateCount = mirrorDependencies.filter((dependency) => dependency.updateAvailable).length;

  useEffect(() => {
    if (missingTools || updateCount > 0 || installation) setOpened(true);
  }, [missingTools, updateCount, installation?.tool]);

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
        ) : updateCount > 0 ? (
          <Badge variant="transparent" color="blue">
            {t("deps.updateCount", { count: updateCount })}
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
          const installable =
            (!dependency.systemAvailable || !dependency.available) &&
            Boolean(dependency.installCommand);
          const mirror = mirrors.get(dependency.tool === "ffprobe" ? "ffmpeg" : dependency.tool);
          const installing =
            installation?.tool === (dependency.tool === "ffprobe" ? "ffmpeg" : dependency.tool);
          const total = installation?.total;
          const received = installation?.received ?? 0;
          const progress = total ? Math.min(100, (received / total) * 100) : 0;
          return (
            <Card key={dependency.tool} withBorder radius="md" padding="sm">
              <Stack gap="xs">
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
                      ? dependency.source === "managed"
                        ? t("deps.managed")
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
                {mirror && dependency.tool !== "ffprobe" && (
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      {t("deps.mirrorVersion", {
                        version: mirror.version,
                        size: (mirror.size / 1024 / 1024).toFixed(1)
                      })}
                    </Text>
                    {mirror.updateAvailable && (
                      <Badge color="blue" variant="light">
                        {t("deps.updateAvailable")}
                      </Badge>
                    )}
                  </Group>
                )}
                {dependency.tool === "ffprobe" && (
                  <Text size="xs" c="dimmed">
                    {t("deps.ffprobeShared")}
                  </Text>
                )}
                {installing && installation && dependency.tool !== "ffprobe" && (
                  <Stack gap="xs" aria-live="polite">
                    <Progress
                      value={total ? progress : 100}
                      animated={!total || progress === 100}
                      aria-label={t("deps.mirrorDownloading")}
                    />
                    <Text size="xs" c="dimmed">
                      {received === 0
                        ? t("deps.mirrorPreparing")
                        : progress === 100
                          ? t("deps.mirrorInstalling")
                          : t("deps.mirrorProgress", {
                              received: (received / 1024 / 1024).toFixed(1),
                              total: total ? (total / 1024 / 1024).toFixed(1) : "?"
                            })}
                    </Text>
                  </Stack>
                )}
                <Group gap="xs" wrap="wrap">
                  {mirror && dependency.tool !== "ffprobe" && (
                    <Button
                      size="compact-sm"
                      variant="light"
                      loading={installing}
                      disabled={installation !== null}
                      leftSection={<IconDownload size={14} />}
                      onClick={() => onMirrorInstall(dependency.tool)}
                    >
                      {mirror.updateAvailable
                        ? t("deps.mirrorUpdate")
                        : dependency.managedAvailable
                          ? t("deps.mirrorReinstall")
                          : t("deps.mirrorInstall")}
                    </Button>
                  )}
                  {installable && (
                    <Button
                      size="compact-sm"
                      variant="subtle"
                      color="teal"
                      disabled={installation !== null}
                      aria-label={t(
                        dependency.healthCheckFailed ? "deps.repairAria" : "deps.installAria",
                        { name: dependency.label }
                      )}
                      onClick={() => onInstall(dependency)}
                    >
                      {dependency.healthCheckFailed ? t("deps.repair") : t("deps.install")}
                    </Button>
                  )}
                </Group>
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </CollapsibleSection>
  );
}
