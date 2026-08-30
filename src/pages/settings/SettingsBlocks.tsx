import { Card, Group, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

const CARD_RADIUS = "calc(var(--mantine-radius-md) + 4px)";

export function SettingsSectionCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Stack gap="xs">
      {title && (
        <Text size="sm" fw={600} px="xs">
          {title}
        </Text>
      )}
      <Card withBorder radius={CARD_RADIUS} padding={0}>
        {children}
      </Card>
    </Stack>
  );
}

interface SettingsRowProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function SettingsRow({ title, description, children }: SettingsRowProps) {
  return (
    <Group justify="space-between" align="center" wrap="nowrap" px="lg" py="md" gap="xl">
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Text size="sm" fw={500}>
          {title}
        </Text>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>
      {children != null && (
        <Group gap={8} wrap="nowrap" style={{ flex: "0 0 auto" }}>
          {children}
        </Group>
      )}
    </Group>
  );
}
