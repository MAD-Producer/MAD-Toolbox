import { ActionIcon, CopyButton, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { t } from "../../locale";

interface CopyIconButtonProps {
  value: string;
  label: string;
}

export function CopyIconButton({ value, label }: CopyIconButtonProps) {
  return (
    <CopyButton value={value} timeout={2000}>
      {({ copied, copy }) => (
        <Tooltip
          label={copied ? t("common.copied") : label}
          position="top"
          events={{ hover: true, focus: true, touch: false }}
        >
          <ActionIcon
            variant={copied ? "light" : "subtle"}
            color={copied ? "teal" : "gray"}
            size="lg"
            aria-label={label}
            onClick={copy}
          >
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}
