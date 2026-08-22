import { Button, Chip, Divider, Group, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { CollapsibleSection } from "../../components/common/CollapsibleSection";
import { t } from "../../locale";
import { DEFAULT_MUSIC_SOURCES, MUSIC_SOURCE_GROUPS } from "./configuration";

interface MusicSourcePickerProps {
  sources: string[];
  onChange: (sources: string[]) => void;
}

export function MusicSourcePicker({ sources, onChange }: MusicSourcePickerProps) {
  const [open, setOpen] = useState(true);

  return (
    <CollapsibleSection
      title={
        <>
          <Text size="sm" fw={500}>
            {t("music.sources.title")}
          </Text>
          <Text size="xs" c="blue">
            {t("music.sources.selected", { count: sources.length })}
          </Text>
        </>
      }
      opened={open}
      onToggle={() => setOpen((value) => !value)}
      action={
        <Button
          size="compact-xs"
          variant="filled"
          onClick={() => onChange([...DEFAULT_MUSIC_SOURCES])}
        >
          {t("music.sources.reset")}
        </Button>
      }
    >
      <Chip.Group multiple value={sources} onChange={onChange}>
        <Stack gap="xs">
          <Text size="xs" c="dimmed">
            {t("music.sources.hint")}
          </Text>
          {MUSIC_SOURCE_GROUPS.map(([groupKey, entries]) => (
            <div key={groupKey}>
              {/* 与依赖安装引导一致的「文字 + 横线延展右边界」分组头，替代弱化的浅色小字 */}
              <Divider mb="sm" label={<Text size="sm">{t(groupKey)}</Text>} labelPosition="left" />
              <Group gap={6}>
                {entries.map(([source, labelKey]) => (
                  <Chip key={source} value={source} size="xs" variant="light">
                    {t(labelKey)}
                  </Chip>
                ))}
              </Group>
            </div>
          ))}
        </Stack>
      </Chip.Group>
    </CollapsibleSection>
  );
}
