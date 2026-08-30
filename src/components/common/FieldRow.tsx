import { Box, Grid, Group, Stack, Switch, Text } from "@mantine/core";
import type { ReactNode } from "react";

/**
 * CC Switch 风格设置行：左标签列 + 右控件占满余宽。
 * 标签列宽 140px（经验值，取中英文最长标签「Download content」不换行的宽度），
 * 顶部 6px 让单行标签与 32px 高的 sm 输入框垂直居中。
 */

const LABEL_WIDTH = 140;

interface FieldRowProps {
  label: ReactNode;
  /** 标签下方的补充说明（灰色小字） */
  description?: ReactNode;
  /** 控件下方的提示（灰色小字，如「默认保存到…」） */
  hint?: ReactNode;
  children: ReactNode;
}

export function FieldRow({ label, description, hint, children }: FieldRowProps) {
  return (
    <Group align="flex-start" wrap="nowrap">
      <Box w={LABEL_WIDTH} style={{ flexShrink: 0, paddingTop: 6 }}>
        <Text size="sm" fw={500}>
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

/** 开关行：标签居左、开关靠右（设置页的右端开关语言）；并排时外层用 Group 包裹，
 * 每项固定宽 1/3 并两端对齐——一行两项，留白落在中间 */
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

/** CC Switch 式开关块条：一行数个描边开关块（标签居左、开关居右），
 * 块数由 columns 决定（默认 4，参照 Routing Enabled），窄窗口落成单列 */
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

/** CC Switch 式分类子容器：描边圆角框 + 蓝色小标题，把同属一类的设置收拢，
 * 用于分节卡片内部再做一层「类别」区分（如下载引擎 / 网络与接口） */
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
