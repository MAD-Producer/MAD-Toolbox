import { ActionIcon, Group, List, ScrollArea, Text } from "@mantine/core";
import { IconFile, IconX } from "@tabler/icons-react";
import { t } from "../../locale";

interface MediaFileListProps {
  inputs: readonly string[];
  onRemove: (path: string) => void;
}

function fileName(path: string): string {
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return index === -1 ? path : path.slice(index + 1);
}

function parentDir(path: string): string {
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return index === -1 ? "" : path.slice(0, index);
}

export function MediaFileList({ inputs, onRemove }: MediaFileListProps) {
  return (
    <ScrollArea.Autosize mah={280}>
      <List spacing="xs" center>
        {inputs.map((path) => (
          <List.Item
            key={path}
            icon={<IconFile size={16} style={{ color: "var(--mantine-color-dimmed)" }} />}
          >
            <Group justify="space-between" wrap="nowrap" gap="xs">
              <Text size="sm" truncate style={{ minWidth: 0 }}>
                <Text span fw={500} inherit>
                  {fileName(path)}
                </Text>
                <Text span size="xs" c="dimmed">
                  {" "}
                  {parentDir(path)}
                </Text>
              </Text>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={t("media.removeFileAria", { name: fileName(path) })}
                onClick={() => onRemove(path)}
              >
                <IconX size={13} />
              </ActionIcon>
            </Group>
          </List.Item>
        ))}
      </List>
    </ScrollArea.Autosize>
  );
}
