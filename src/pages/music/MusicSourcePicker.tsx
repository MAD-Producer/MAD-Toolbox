import { Button, Chip, Divider, Group, Stack, Text } from "@mantine/core";
import { IconMusic } from "@tabler/icons-react";
import { useState } from "react";
import { SettingsSection } from "../../components/common/SettingsSection";
import { t } from "../../locale";
import { DEFAULT_MUSIC_SOURCES, MUSIC_SOURCE_GROUPS } from "./configuration";

interface MusicSourcePickerProps {
  sources: string[];
  onChange: (sources: string[]) => void;
}

export function MusicSourcePicker({ sources, onChange }: MusicSourcePickerProps) {
  const [open, setOpen] = useState(true);

  return (
    <SettingsSection
      icon={<IconMusic size={20} stroke={1.8} />}
      title={t("music.sources.title")}
      action={
        <Group gap="xs" wrap="nowrap">
          <Text size="xs" c="blue">
            {t("music.sources.selected", { count: sources.length })}
          </Text>
          <Button
            size="compact-xs"
            variant="filled"
            onClick={() => onChange([...DEFAULT_MUSIC_SOURCES])}
          >
            {t("music.sources.reset")}
          </Button>
        </Group>
      }
      opened={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <Chip.Group multiple value={sources} onChange={onChange}>
        <Stack gap="xs">
          <Text size="xs" c="dimmed">
            {t("music.sources.hint")}
          </Text>
          {MUSIC_SOURCE_GROUPS.map(([groupKey, entries]) => (
            <div key={groupKey}>
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
    </SettingsSection>
  );
}
