import { Box, Grid, Group, Stack, Switch, Text } from "@mantine/core";
import type { ReactNode } from "react";

const LABEL_WIDTH = 160;

interface FieldRowProps {
  label: ReactNode;
  description?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}

export function FieldRow({ label, description, hint, children }: FieldRowProps) {
  return (
    <Group align="flex-start" wrap="nowrap">
      <Box w={LABEL_WIDTH} style={{ flexShrink: 0, paddingTop: 6 }}>
        <Text size="md" fw={500}>
          {label}
        </Text>
        {description ? (
          <Text size="xs" c="dimmed" mt={2}>
            {description}
          </Text>
        ) : null}
      </Box>
      <Box style={{ flex: 1, minWidth: 0 }}>
        {children}
        {hint ? (
          <Text size="xs" c="dimmed" mt={4}>
            {hint}
          </Text>
        ) : null}
      </Box>
    </Group>
  );
}

interface SwitchRowProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function SwitchRow({ label, checked, disabled, onChange }: SwitchRowProps) {
  return (
    <Group justify="space-between" wrap="nowrap" align="center">
      <Text size="sm" fw={500}>
        {label}
      </Text>
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </Group>
  );
}

export interface SwitchTileItem {
  key: string;
  label: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}

export function SwitchTileGrid({
  items,
  columns = 4,
  disabled
}: {
  items: ReadonlyArray<SwitchTileItem>;
  columns?: 2 | 3 | 4;
  disabled?: boolean;
}) {
  const span = columns === 4 ? 3 : columns === 3 ? 4 : 6;
  return (
    <Grid gap="sm">
      {items.map((item) => (
        <Grid.Col key={item.key} span={{ base: 12, sm: span }}>
          <Box
            p="xs"
            style={{
              border: "1px solid var(--mantine-color-default-border)",
              borderRadius: "var(--mantine-radius-md)"
            }}
          >
            <SwitchRow
              label={item.label}
              checked={item.checked}
              disabled={disabled}
              onChange={item.onToggle}
            />
          </Box>
        </Grid.Col>
      ))}
    </Grid>
  );
}

export function OptionGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box
      p="md"
      style={{
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: "var(--mantine-radius-md)"
      }}
    >
      <Text size="sm" fw={600} c="var(--mantine-color-blue-filled)" mb="sm">
        {title}
      </Text>
      <Stack gap="md">{children}</Stack>
    </Box>
  );
}
