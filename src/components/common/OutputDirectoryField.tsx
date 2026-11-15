import { IconArrowBackUp, IconFolderOpen } from "@tabler/icons-react";
import { t } from "../../locale";
import { IconButton } from "../ui/icon-button";
import { Input } from "../ui/input";
import { Tooltip } from "../ui/tooltip";
import { FieldWithActions } from "./FieldWithActions";

interface OutputDirectoryFieldProps {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  /** 输入框 DOM id（由调用方生成，配合 FieldRow htmlFor 关联标签） */
  inputId?: string;
  /** 提示文本 id（由调用方生成，转挂 aria-describedby） */
  describedById?: string;
  onChange: (value: string) => void;
  onBrowse: () => Promise<void>;
  resolveDefault?: () => Promise<string | null>;
}

/** 输出目录输入行：恢复默认 + 浏览两个动作按钮 */
export function OutputDirectoryField({
  value,
  disabled = false,
  placeholder,
  inputId,
  describedById,
  onChange,
  onBrowse,
  resolveDefault
}: OutputDirectoryFieldProps) {
  const actions = (
    <>
      {resolveDefault ? (
        <Tooltip label={t("common.restoreDefault")}>
          <span className="inline-flex">
            <IconButton
              label={t("common.restoreDefault")}
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                void resolveDefault().then((directory) => {
                  if (directory) onChange(directory);
                });
              }}
            >
              <IconArrowBackUp size={16} stroke={1.8} />
            </IconButton>
          </span>
        </Tooltip>
      ) : null}
      <Tooltip label={t("common.selectOutputDirectory")}>
        <span className="inline-flex">
          <IconButton
            label={t("common.selectOutputDirectory")}
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => void onBrowse()}
          >
            <IconFolderOpen size={16} stroke={1.8} />
          </IconButton>
        </span>
      </Tooltip>
    </>
  );

  return (
    <FieldWithActions actions={actions}>
      <Input
        id={inputId}
        aria-describedby={describedById}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled}
      />
    </FieldWithActions>
  );
}
