import { Box, Card, Collapse, Group, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import type { ReactNode } from "react";

interface SettingsSectionProps {
  /** 头部左侧的蓝色小图标 */
  icon?: ReactNode;
  /** 不传 title 则渲染无头卡片：纯描边容器直接包内容 */
  title?: string;
  /** 标题下方的灰色副标题 */
  description?: ReactNode;
  /** 头部右侧的附加元素（徽标 / 计数 / 操作按钮），位于折叠箭头左侧；
   * 可交互控件放在这里，点击区只覆盖标题部分 */
  action?: ReactNode;
  /** 传入 opened/onToggle 则整卡可折叠，点击标题区切换 */
  opened?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}

/** CC Switch 风格分节卡片：描边容器，头部为「图标 + 标题 + 副标题（+ 右侧动作）」，
 * 其下是内容区；主表单卡可省略头部，只留内容。 */
export function SettingsSection({
  icon,
  title,
  description,
  action,
  opened,
  onToggle,
  children
}: SettingsSectionProps) {
  if (!title) {
    return (
      <Card withBorder padding={0} radius="md">
        <Box p="lg">{children}</Box>
      </Card>
    );
  }

  const collapsible = typeof opened === "boolean" && typeof onToggle === "function";
  const heading = (
    <Group gap="sm" wrap="nowrap">
      <Box c="var(--mantine-color-blue-filled)" style={{ display: "flex" }} lh={0}>
        {icon}
      </Box>
      <Box>
        <Text size="md" fw={600}>
          {title}
        </Text>
        {description ? (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        ) : null}
      </Box>
    </Group>
  );

  return (
    <Card withBorder padding={0} radius="md">
      <Group justify="space-between" wrap="nowrap" px="lg" py="md" gap="sm">
        {collapsible ? (
          <UnstyledButton
            onClick={onToggle}
            aria-expanded={opened}
            style={{ flex: "1 1 auto", minWidth: 0, display: "block", textAlign: "left" }}
          >
            {heading}
          </UnstyledButton>
        ) : (
          <Box style={{ flex: "1 1 auto", minWidth: 0 }}>{heading}</Box>
        )}
        <Group gap="xs" wrap="nowrap">
          {action}
          {collapsible ? (
            <IconChevronDown
              size={18}
              stroke={1.8}
              style={{
                transform: opened ? "rotate(180deg)" : "none",
                transition: "transform 150ms ease"
              }}
            />
          ) : null}
        </Group>
      </Group>
      <Collapse expanded={!collapsible || opened}>
        <Box p="lg">{children}</Box>
      </Collapse>
    </Card>
  );
}
