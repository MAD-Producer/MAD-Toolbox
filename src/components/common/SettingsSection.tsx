import { Box, Card, Collapse, Group, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import type { ReactNode } from "react";

interface SettingsSectionProps {
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  opened?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}

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
