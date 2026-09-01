import { ActionIcon, Input, Tooltip } from "@mantine/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { IconFolderOpen, IconHelp } from "@tabler/icons-react";
import { t } from "../../locale";
import { FieldWithActions } from "./FieldWithActions";

const COOKIE_HELP_URL = "https://toolbox.madproducer.cn/#faq";

interface CookieFileFieldProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBrowse: () => void | Promise<void>;
}

export function CookieFileField({ value, disabled, onChange, onBrowse }: CookieFileFieldProps) {
  const actions = (
    <>
      <Tooltip label={t("common.cookieHelp")}>
        <ActionIcon
          variant="default"
          size="input-sm"
          disabled={disabled}
          aria-label={t("common.cookieHelp")}
          onClick={() => void openUrl(COOKIE_HELP_URL)}
        >
          <IconHelp size={16} stroke={1.7} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t("common.selectCookieFile")}>
        <ActionIcon
          variant="default"
          size="input-sm"
          disabled={disabled}
          aria-label={t("common.selectCookieFile")}
          onClick={() => void onBrowse()}
        >
          <IconFolderOpen size={16} stroke={1.7} />
        </ActionIcon>
      </Tooltip>
    </>
  );

  return (
    <FieldWithActions actions={actions}>
      <Input
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled}
      />
    </FieldWithActions>
  );
}
