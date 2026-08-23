import {
  ActionIcon,
  Group,
  Input,
  NumberInput,
  Stack,
  Textarea,
  TextInput,
  Tooltip
} from "@mantine/core";
import { IconFolderOpen } from "@tabler/icons-react";
import { FieldWithActions } from "../../components/common/FieldWithActions";
import { L2TabNav } from "../../components/common/L2TabNav";
import { t } from "../../locale";
import type { MusicFormPatch, MusicFormState } from "./configuration";

interface MusicConfigurationPanelProps {
  form: MusicFormState;
  onChange: (patch: MusicFormPatch) => void;
  onPickOutputDirectory: () => void;
  /** 设置页的全局代理；已设置时作为占位提示，留空提交即使用它 */
  globalProxy?: string | null;
}

export function MusicConfigurationPanel({
  form,
  onChange,
  onPickOutputDirectory,
  globalProxy
}: MusicConfigurationPanelProps) {
  return (
    <Stack gap="sm">
      <L2TabNav
        items={[
          { page: "search", label: t("music.mode.search") },
          { page: "playlist", label: t("music.mode.playlist") }
        ]}
        value={form.mode}
        onChange={(mode) => onChange({ mode })}
        aria-label={t("music.mode.aria")}
      />
      {form.mode === "search" ? (
        <TextInput
          label={t("music.keyword.label")}
          placeholder={t("music.keyword.placeholder")}
          value={form.keyword}
          onChange={(event) => onChange({ keyword: event.currentTarget.value })}
        />
      ) : (
        <TextInput
          label={t("music.playlistUrl.label")}
          description={t("music.playlistUrl.description")}
          placeholder="https://music.163.com/#/playlist?id=..."
          value={form.playlistUrl}
          onChange={(event) => onChange({ playlistUrl: event.currentTarget.value })}
        />
      )}
      <Group grow>
        {/* Input.Wrapper 承担 label/description，组合行内的按钮才能与输入框同高对齐；
            Input 自带的 5px 上边距同样抵消，改由整行承担，避免行内错位 */}
        <Input.Wrapper
          label={t("music.outputDirectory")}
          description={t("common.outputDirectoryHint")}
        >
          <FieldWithActions
            mt="calc(var(--mantine-spacing-xs) / 2)"
            actions={
              <Tooltip label={t("common.selectDirectory")}>
                <ActionIcon
                  variant="default"
                  size="input-sm"
                  aria-label={t("music.outputDirectory.aria")}
                  onClick={onPickOutputDirectory}
                >
                  <IconFolderOpen size={16} stroke={1.7} />
                </ActionIcon>
              </Tooltip>
            }
          >
            <Input
              placeholder={t("music.outputDirectory.placeholder")}
              value={form.outputDirectory}
              onChange={(event) => onChange({ outputDirectory: event.currentTarget.value })}
              style={{ marginTop: 0 }}
            />
          </FieldWithActions>
        </Input.Wrapper>
        <NumberInput
          label={t("music.searchSize.label")}
          description={t("music.searchSize.description")}
          min={1}
          max={100}
          value={form.searchSize}
          onChange={(value) => onChange({ searchSize: typeof value === "number" ? value : 5 })}
        />
        <NumberInput
          label={t("music.threadCount.label")}
          description={t("music.threadCount.description")}
          min={1}
          max={50}
          value={form.threadCount}
          onChange={(value) => onChange({ threadCount: typeof value === "number" ? value : 5 })}
        />
        <TextInput
          label={t("music.proxy.label")}
          description={t("music.proxy.description")}
          placeholder={globalProxy ?? "http://127.0.0.1:7890"}
          value={form.proxy}
          onChange={(event) => onChange({ proxy: event.currentTarget.value })}
        />
      </Group>
      <Textarea
        label={t("music.cookies.label")}
        description={t("music.cookies.description")}
        autosize
        minRows={1}
        value={form.cookies}
        onChange={(event) => onChange({ cookies: event.currentTarget.value })}
      />
    </Stack>
  );
}
