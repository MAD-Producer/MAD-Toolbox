import { ActionIcon, Card, Code, Divider, Group, Stack, Text, Tooltip } from "@mantine/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { IconExternalLink, IconWorld } from "@tabler/icons-react";
import type { DependencyStatus, ToolName } from "../../contracts/dependency";
import { isWindows, pipCommand, toolInstallCommands } from "../../lib/platform";
import { t } from "../../locale";
import { CopyIconButton } from "./CopyIconButton";

const PIP_MIRRORS = [
  {
    id: "ustc",
    name: () => t("deps.pipMirrorUstc"),
    url: "https://mirrors.ustc.edu.cn/pypi/simple",
    help: "https://mirrors.ustc.edu.cn/help/pypi.html"
  },
  {
    id: "tuna",
    name: () => t("deps.pipMirrorTuna"),
    url: "https://pypi.tuna.tsinghua.edu.cn/simple",
    help: "https://mirrors.tuna.tsinghua.edu.cn/help/pypi/"
  }
] as const;

const INSTALL_DESCRIPTIONS: Partial<Record<ToolName, () => string>> = {
  ffmpeg: () => t("deps.desc.ffmpeg"),
  "yt-dlp": () => t("deps.desc.ytDlp"),
  mediainfo: () => t("deps.desc.mediainfo"),
  deno: () => t("deps.desc.deno"),
  python: () => t("deps.desc.python"),
  musicdl: () => t("deps.desc.musicdl")
};

interface DependencyInstallCardsProps {
  dependencies: DependencyStatus[];
}

const tooltipEvents = { hover: true, focus: true, touch: false } as const;

export function DependencyInstallCards({ dependencies }: DependencyInstallCardsProps) {
  const missing = dependencies.filter((item) => !item.available && toolInstallCommands[item.tool]);
  if (missing.length === 0) return null;

  return (
    <Stack gap="md">
      {missing.map((dependency) => {
        const command = toolInstallCommands[dependency.tool] as string;
        return (
          <Card
            key={dependency.tool}
            withBorder
            radius="calc(var(--mantine-radius-md) + 4px)"
            padding="md"
          >
            <Stack gap="xs">
              <Group gap="xs">
                <Text fw={500}>{dependency.label}</Text>
                {dependency.tool === "musicdl" && (
                  <Text span size="xs" c="dimmed">
                    {t("deps.optionalSuffix")}
                  </Text>
                )}
              </Group>
              <Text size="sm" c="dimmed">
                {INSTALL_DESCRIPTIONS[dependency.tool]?.()}
              </Text>
              {dependency.tool === "musicdl" && (
                <Text size="sm" c="dimmed">
                  {t("deps.musicdlPipxNote", { manager: isWindows ? "winget" : "Homebrew" })}
                </Text>
              )}
              <Group gap={6} wrap="nowrap" align="flex-start">
                <Code
                  block
                  style={{ flex: 1, minWidth: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {command}
                </Code>
                <CopyIconButton value={command} label={t("deps.copyInstallCommand")} />
              </Group>
              {dependency.tool === "musicdl" && (
                <>
                  <Divider
                    my={4}
                    label={
                      <Group gap={4} wrap="nowrap">
                        <IconWorld size={14} />
                        <Text size="sm">{t("deps.pipMirrorTitle")}</Text>
                      </Group>
                    }
                    labelPosition="left"
                  />
                  <Text size="sm" c="dimmed">
                    {t("deps.pipMirrorHint")}
                  </Text>
                  {PIP_MIRRORS.map((mirror) => {
                    const mirrorCommand = `${pipCommand} config set global.index-url ${mirror.url}`;
                    return (
                      <Group key={mirror.id} justify="space-between" wrap="nowrap">
                        <div style={{ minWidth: 0 }}>
                          <Text size="sm">{mirror.name()}</Text>
                          <Code block style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                            {mirrorCommand}
                          </Code>
                        </div>
                        <Group gap={4} wrap="nowrap">
                          <CopyIconButton value={mirrorCommand} label={t("deps.copyCommand")} />
                          <Tooltip
                            label={t("deps.mirrorHelpTooltip")}
                            position="top"
                            events={tooltipEvents}
                          >
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="lg"
                              aria-label={t("deps.mirrorHelpAria", { name: mirror.name() })}
                              onClick={() => void openUrl(mirror.help)}
                            >
                              <IconExternalLink size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>
                    );
                  })}
                  <Text size="xs">
                    {t("deps.restoreOfficialSource")}
                    <Code style={{ overflowWrap: "anywhere" }}>
                      {`${pipCommand} config unset global.index-url`}
                    </Code>
                  </Text>
                </>
              )}
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
