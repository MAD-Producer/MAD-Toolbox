import { Modal, Stack, Text } from "@mantine/core";
import { t } from "../../locale";

interface BilibiliLoginDialogProps {
  active: boolean;
  qrDataUrl: string | null;
  onClose: () => void;
}

export function BilibiliLoginDialog({ active, qrDataUrl, onClose }: BilibiliLoginDialogProps) {
  return (
    <Modal
      opened={active && qrDataUrl !== null}
      onClose={onClose}
      title={t("bilibili.login.title")}
      centered
    >
      <Stack align="center" gap="sm">
        {qrDataUrl && (
          <img src={qrDataUrl} alt={t("bilibili.login.qrAlt")} width={280} height={280} />
        )}
        <Text size="sm" c="dimmed">
          {t("bilibili.login.hint")}
        </Text>
      </Stack>
    </Modal>
  );
}
