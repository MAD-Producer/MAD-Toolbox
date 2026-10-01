import { ActionIcon, Input, Tooltip } from "@mantine/core";
import { IconArrowBackUp, IconFolderOpen } from "@tabler/icons-react";
import { t } from "../../locale";
import { FieldWithActions } from "./FieldWithActions";

interface OutputDirectoryFieldProps {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onBrowse: () => Promise<void>;
  resolveDefault?: () => Promise<string | null>;
}

export function OutputDirectoryField({
  value,
  disabled = false,
  placeholder,
  onChange,
  onBrowse,
  resolveDefault
}: OutputDirectoryFieldProps) {
  const actions = (
    <>
      {resolveDefault ? (
        <Tooltip label={t("common.restoreDefault")}>
          <ActionIcon
            variant="default"
            size="input-sm"
            disabled={disabled}
            aria-label={t("common.restoreDefault")}
            onClick={() => {
              void resolveDefault().then((directory) => {
                if (directory) onChange(directory);
              });
            }}
          >
            <IconArrowBackUp size={16} stroke={1.7} />
          </ActionIcon>
        </Tooltip>
      ) : null}
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
    </>
  );

  return (
    <FieldWithActions actions={actions}>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled}
      />
    </FieldWithActions>
  );
}
