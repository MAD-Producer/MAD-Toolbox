import { openUrl } from "@tauri-apps/plugin-opener";
import {
  IconCircleCheck,
  IconCircleX,
  IconFolderOpen,
  IconHelp,
  IconPlus,
  IconShieldCheck,
  IconX
} from "@tabler/icons-react";
import type { CookieFileOption } from "../../contracts/types";
import { t } from "../../locale";
import { IconButton } from "../ui/icon-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "../ui/select";
import { Tooltip } from "../ui/tooltip";
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

/** 校验钮文案随状态变化：idle 提示动作，valid/invalid 播报当前校验结论 */
function verificationLabel(status: CookieVerificationStatus) {
  if (status === "valid") return t("network.cookieVerify.valid");
  if (status === "invalid") return t("network.cookieVerify.invalid");
  return t("network.cookieVerify.action");
}

function verificationIcon(status: CookieVerificationStatus) {
  if (status === "valid") return <IconCircleCheck size={16} stroke={1.8} className="text-success" />;
  if (status === "invalid") return <IconCircleX size={16} stroke={1.8} className="text-destructive" />;
  return <IconShieldCheck size={16} stroke={1.8} />;
}

/**
 * Cookie 文件选择行：文件下拉（含"添加"入口）+ 验证 / 帮助 / 浏览 / 清除动作。
 * 触发器不设 aria-label（可见内容即名称，避免与浏览钮重名）；
 * 动作钮统一以 span 桥接 Tooltip，保证禁用态也能显示原因。
 */
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
  const actions = (
    <>
      {onVerify ? (
        <Tooltip label={verificationLabel(verificationStatus)}>
          <span className="inline-flex">
            <IconButton
              label={verificationLabel(verificationStatus)}
              variant="outline"
              size="sm"
              loading={verifying}
              disabled={disabled || verifying}
              onClick={() => void onVerify()}
            >
              {verificationIcon(verificationStatus)}
            </IconButton>
          </span>
        </Tooltip>
      ) : null}
      <Tooltip label={t("common.cookieHelp")}>
        <span className="inline-flex">
          <IconButton
            label={t("common.cookieHelp")}
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => void openUrl(COOKIE_HELP_URL)}
          >
            <IconHelp size={16} stroke={1.8} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip label={t("common.selectCookieFile")}>
        <span className="inline-flex">
          <IconButton
            label={t("common.selectCookieFile")}
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => void onBrowse()}
          >
            <IconFolderOpen size={16} stroke={1.8} />
          </IconButton>
        </span>
      </Tooltip>
      {value ? (
        <Tooltip label={t("common.clear")}>
          <span className="inline-flex">
            <IconButton
              label={t("common.clear")}
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={disabled}
              onClick={() => onChange("")}
            >
              <IconX size={16} stroke={1.8} />
            </IconButton>
          </span>
        </Tooltip>
      ) : null}
    </>
  );

  return (
    <FieldWithActions actions={actions}>
      <Select
        value={value || undefined}
        onValueChange={(next) => {
          if (next === ADD_COOKIE_FILE) {
            onAddCookieFile?.();
            return;
          }
          onChange(next);
        }}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={t("common.cookieFilePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.path} value={option.path}>
              {option.alias}
            </SelectItem>
          ))}
          {value && !options.some((option) => option.path === value) ? (
            <SelectItem value={value}>
              <span className="block max-w-[24rem] truncate">{value}</span>
            </SelectItem>
          ) : null}
          {onAddCookieFile ? (
            <>
              <SelectSeparator />
              <SelectItem value={ADD_COOKIE_FILE}>
                <span className="flex items-center gap-1.5">
                  <IconPlus size={16} stroke={1.8} />
                  {t("common.addCookieFileInSettings")}
                </span>
              </SelectItem>
            </>
          ) : null}
        </SelectContent>
      </Select>
    </FieldWithActions>
  );
}
