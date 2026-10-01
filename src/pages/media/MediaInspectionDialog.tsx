import { Code, Modal, ScrollArea } from "@mantine/core";
import { t } from "../../locale";

interface MediaInspectionDialogProps {
  active: boolean;
  summary: string | null;
  onClose: () => void;
}

export function MediaInspectionDialog({ active, summary, onClose }: MediaInspectionDialogProps) {
  return (
    <Modal
      opened={active && summary !== null}
      onClose={onClose}
      title={t("media.inspection.title")}
      size="lg"
    >
      <ScrollArea h={360}>
        <Code block style={{ whiteSpace: "pre-wrap" }}>
          {summary}
        </Code>
      </ScrollArea>
    </Modal>
  );
}
