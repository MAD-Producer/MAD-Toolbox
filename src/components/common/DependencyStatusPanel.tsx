import { useState } from "react";
import { ActionIcon, Badge, Button, Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconCircleCheck, IconDownload, IconRefresh } from "@tabler/icons-react";
import { isWindows, toolInstallCommands } from "../../lib/platform";
import type { DependencyStatus } from "../../contracts/dependency";
import { CollapsibleSection } from "./CollapsibleSection";
import { FieldWithActions } from "./FieldWithActions";

interface DependencyStatusPanelProps {
  dependencies: DependencyStatus[];
  loading: boolean;
  onRefresh: () => void;
  onInstall: (dependency: DependencyStatus) => void;
}

/**
 * 状态列表：默认折叠只显示汇总徽标，展开逐工具三行（名称/版本/路径）；
 * 缺失且可装的工具在列表项右侧（列表外）提供一键安装；安装引导卡由 DependencyInstallCards 承担。
 */
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
            {missing.length} 个必要工具未就绪
          </Badge>
        ) : (
          <Badge variant="transparent" color="teal" leftSection={<IconCircleCheck size={12} />}>
            必要工具均已就绪
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
          重新检测
        </Button>
      }
    >
      <Stack gap="xs">
        {dependencies.map((dependency) => {
          const installable =
            !dependency.available && Boolean(toolInstallCommands[dependency.tool]);
          return (
            // stretch：安装按钮随内容卡片拉满整行高度，与左侧卡片边缘对齐
            <FieldWithActions
              key={dependency.tool}
              align="stretch"
              actions={
                installable && (
                  <Tooltip
                    label={`一键安装（${isWindows ? "winget" : "Homebrew"}）`}
                    position="top"
                  >
                    <ActionIcon
                      variant="light"
                      color="teal"
                      radius="md"
                      size="xl"
                      style={{ height: "auto" }}
                      aria-label={`一键安装 ${dependency.label}`}
                      onClick={() => onInstall(dependency)}
                    >
                      <IconDownload size={18} />
                    </ActionIcon>
                  </Tooltip>
                )
              }
            >
              <Card withBorder padding="sm">
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
                          可选
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
                          ? "应用内置"
                          : "系统"
                        : "未就绪"}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" truncate>
                    {dependency.available ? (dependency.version ?? "版本未知") : "未安装"}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {dependency.available
                      ? (dependency.path ?? "路径未知")
                      : (dependency.installHint ?? "未找到可用版本")}
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
