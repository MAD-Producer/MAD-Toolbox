import { Code, Text } from "@mantine/core";

interface CommandPreviewProps {
  display: string | null;
  error?: string | null;
}

export function CommandPreview({ display, error }: CommandPreviewProps) {
  if (error) {
    return (
      <Text size="sm" c="red">
        {error}
      </Text>
    );
  }
  return (
    <Code block style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
      {display ?? "…"}
    </Code>
  );
}
