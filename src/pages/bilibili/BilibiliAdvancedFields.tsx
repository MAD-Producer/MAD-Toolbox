import { Group, PasswordInput, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import { t, type TranslationKey } from "../../locale";
import type { BilibiliFormState } from "./form";

const ADVANCED_SWITCHES: Array<[keyof BilibiliFormState, TranslationKey]> = [
  ["useMp4box", "bilibili.advanced.useMp4box"],
  ["useAria2c", "bilibili.advanced.useAria2c"],
  ["showAll", "bilibili.advanced.showAll"],
  ["hideStreams", "bilibili.advanced.hideStreams"],
  ["skipMux", "bilibili.advanced.skipMux"],
  ["multiThread", "bilibili.advanced.multiThread"],
  ["forceHttp", "bilibili.advanced.forceHttp"],
  ["videoAscending", "bilibili.advanced.videoAscending"],
  ["audioAscending", "bilibili.advanced.audioAscending"],
  ["allowPcdn", "bilibili.advanced.allowPcdn"],
  ["forceReplaceHost", "bilibili.advanced.forceReplaceHost"],
  ["saveArchive", "bilibili.advanced.saveArchive"],
  ["debug", "bilibili.advanced.debug"]
];

const ADVANCED_VALUES: Array<[keyof BilibiliFormState, TranslationKey, string]> = [
  ["filePattern", "bilibili.advanced.filePattern", ""],
  ["multiFilePattern", "bilibili.advanced.multiFilePattern", ""],
  ["language", "bilibili.advanced.language", ""],
  ["userAgent", "bilibili.advanced.userAgent", ""],
  ["aria2cArgs", "bilibili.advanced.aria2cArgs", ""],
  ["mp4boxPath", "bilibili.advanced.mp4boxPath", ""],
  ["aria2cPath", "bilibili.advanced.aria2cPath", ""],
  ["uposHost", "bilibili.advanced.uposHost", ""],
  ["delayPerPage", "bilibili.advanced.delayPerPage", ""],
  ["host", "bilibili.advanced.host", ""],
  ["epHost", "bilibili.advanced.epHost", ""],
  ["area", "bilibili.advanced.area", "hk / tw / th"],
  ["configFile", "bilibili.advanced.configFile", ""]
];

interface BilibiliAdvancedFieldsProps {
  form: BilibiliFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<BilibiliFormState>) => void;
}

export function BilibiliAdvancedFields({ form, disabled, onUpdate }: BilibiliAdvancedFieldsProps) {
  return (
    <Stack gap="sm">
      <Group gap="lg">
        {ADVANCED_SWITCHES.map(([key, labelKey]) => (
          <Switch
            key={key}
            label={t(labelKey)}
            checked={form[key] as boolean}
            onChange={(event) => onUpdate({ [key]: event.currentTarget.checked })}
            disabled={disabled}
          />
        ))}
      </Group>
      <Group grow>
        <PasswordInput
          label="Cookie"
          description={t("bilibili.advanced.cookieHint")}
          value={form.cookie}
          onChange={(event) => onUpdate({ cookie: event.currentTarget.value })}
          disabled={disabled}
        />
        <PasswordInput
          label="Access Token"
          description={t("bilibili.advanced.accessTokenHint")}
          value={form.accessToken}
          onChange={(event) => onUpdate({ accessToken: event.currentTarget.value })}
          disabled={disabled}
        />
      </Group>
      {chunk(ADVANCED_VALUES, 3).map((row, index) => (
        <Group grow key={index}>
          {row.map(([key, labelKey, placeholder]) => (
            <TextInput
              key={key}
              label={t(labelKey)}
              placeholder={placeholder}
              value={form[key] as string}
              onChange={(event) => onUpdate({ [key]: event.currentTarget.value })}
              disabled={disabled}
            />
          ))}
        </Group>
      ))}
      <Textarea
        label={t("bilibili.advanced.extraArgs")}
        description={t("bilibili.advanced.extraArgsHint")}
        autosize
        minRows={2}
        value={form.extraArgs}
        onChange={(event) => onUpdate({ extraArgs: event.currentTarget.value })}
        disabled={disabled}
      />
    </Stack>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}
