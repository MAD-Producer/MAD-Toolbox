import { ActionIcon, Group, Loader, Select, Text, Tooltip } from "@mantine/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  IconCircleCheck,
  IconCircleX,
  IconFolderOpen,
  IconHelp,
  IconPlus,
  IconShieldCheck
} from "@tabler/icons-react";
import type { CookieFileOption } from "../../contracts/types";
import { t } from "../../locale";
import { FieldWithActions } from "./FieldWithActions";

const COOKIE_HELP_URL = "https://toolbox.madproducer.cn/#faq";
const ADD_COOKIE_FILE = "__add_cookie_file__";

export type CookieVerificationStatus = "idle" | "valid" | "invalid";

interface CookieFileFieldProps {
  value: string;
  options: CookieFileOption[];
  disabled?: boolean;
  verificationStatus?: CookieVerificationStatus;
  verifying?: boolean;
  onChange: (value: string) => void;
  onBrowse: () => void | Promise<void>;
  onVerify?: () => void | Promise<void>;
  onAddCookieFile?: () => void;
}

function verificationLabel(status: CookieVerificationStatus) {
  if (status === "valid") return t("network.cookieVerify.valid");
  if (status === "invalid") return t("network.cookieVerify.invalid");
  return t("network.cookieVerify.action");
}

function verificationIcon(status: CookieVerificationStatus, verifying: boolean) {
  if (verifying) return <Loader size={16} />;
  if (status === "valid") {
    return <IconCircleCheck size={16} stroke={1.7} color="var(--mantine-color-green-6)" />;
  }
  if (status === "invalid") {
    return <IconCircleX size={16} stroke={1.7} color="var(--mantine-color-red-6)" />;
  }
  return <IconShieldCheck size={16} stroke={1.7} />;
}

export function CookieFileField({
  value,
  options,
  disabled,
  verificationStatus = "idle",
  verifying = false,
  onChange,
  onBrowse,
  onVerify,
  onAddCookieFile
}: CookieFileFieldProps) {
  const data = options.map((option) => ({ value: option.path, label: option.alias }));
  if (value && !options.some((option) => option.path === value)) {
    data.push({ value, label: value });
  }
  data.push({ value: ADD_COOKIE_FILE, label: "" });
  const actions = (
    <>
      {onVerify ? (
        <Tooltip label={verificationLabel(verificationStatus)}>
          <ActionIcon
            variant="default"
            size="input-sm"
            disabled={disabled || verifying}
            aria-label={t("network.cookieVerify.action")}
            onClick={() => void onVerify()}
          >
            {verificationIcon(verificationStatus, verifying)}
          </ActionIcon>
        </Tooltip>
      ) : null}
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
      <Select
        data={data}
        value={value || null}
        placeholder={t("common.selectCookieFile")}
        clearable
        disabled={disabled}
        aria-label={t("common.selectCookieFile")}
        onChange={(next) => {
          if (next === ADD_COOKIE_FILE) {
            onAddCookieFile?.();
            return;
          }
          onChange(next ?? "");
        }}
        renderOption={({ option }) =>
          option.value === ADD_COOKIE_FILE ? (
            <Group gap={6} wrap="nowrap">
              <IconPlus size={15} stroke={1.7} />
              <Text size="sm">{t("common.addCookieFileInSettings")}</Text>
            </Group>
          ) : (
            <span>{option.label}</span>
          )
        }
      />
    </FieldWithActions>
  );
}
