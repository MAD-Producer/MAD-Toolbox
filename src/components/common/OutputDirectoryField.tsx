import { ActionIcon, Input, Tooltip } from "@mantine/core";
import { IconFolderOpen } from "@tabler/icons-react";
import { t } from "../../locale";
import { FieldWithActions } from "./FieldWithActions";

interface OutputDirectoryFieldProps {
  value: string;
  disabled: boolean;
  /** 各工具的留空回退目录不同，占位文案由调用方给出 */
  placeholder?: string;
  onChange: (value: string) => void;
  onBrowse: () => Promise<void>;
  /** 行式布局（标签在行首，如 CC Switch 风格设置行）时不再输出自带的 label/description */
  bare?: boolean;
}

export function OutputDirectoryField({
  value,
  disabled,
  placeholder,
  onChange,
  onBrowse,
  bare = false
}: OutputDirectoryFieldProps) {
  const actions = (
    <Tooltip label={t("common.selectDirectory")}>
      <ActionIcon
        variant="default"
        size="input-sm"
        disabled={disabled}
        aria-label={t("common.selectOutputDirectory")}
        onClick={() => void onBrowse()}
      >
        <IconFolderOpen size={16} stroke={1.7} />
      </ActionIcon>
    </Tooltip>
  );

  const field = (
    <FieldWithActions actions={actions}>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled}
      />
    </FieldWithActions>
  );

  if (bare) {
    return field;
  }

  return (
    // Input.Wrapper 承担 label/description，组合行内的按钮才能与输入框同高对齐
    <Input.Wrapper
      label={t("common.outputDirectory")}
      description={t("common.outputDirectoryHint")}
    >
      {/* 有 label 时 Input 会自带 5px 上边距（label→输入框的间距），落在组合行内部会让
          输入框与按钮错位：在 Input 上抵消，改由整行承担同样的间距 */}
      <FieldWithActions mt="calc(var(--mantine-spacing-xs) / 2)" actions={actions}>
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          disabled={disabled}
          style={{ marginTop: 0 }}
        />
      </FieldWithActions>
    </Input.Wrapper>
  );
}
