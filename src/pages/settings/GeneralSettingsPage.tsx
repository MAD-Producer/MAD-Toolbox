import {
  ActionIcon,
  Button,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip,
  useMantineColorScheme,
  type MantineColorScheme
} from "@mantine/core";
import { notifications } from "../../lib/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  IconArrowBackUp,
  IconDeviceDesktop,
  IconBookDownload,
  IconFolderOpen,
  IconLanguage,
  IconMoon,
  IconSun,
  IconWorld
} from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { FieldWithActions } from "../../components/common/FieldWithActions";
import { t, type LanguageChoice } from "../../locale";
import type { AppSettings } from "./api";

interface GeneralSettingsPageProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<AppSettings>;
  onSetLanguage: (choice: LanguageChoice) => void;
}

function themeOptionLabel(icon: ReactNode, text: string) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      {text}
    </span>
  );
}

export function GeneralSettingsPage({ settings, onSave, onSetLanguage }: GeneralSettingsPageProps) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [directory, setDirectory] = useState(settings.defaultOutputDirectory || "");
  const [proxy, setProxy] = useState(settings.proxy || "");
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState<LanguageChoice>(settings.language ?? "auto");

  useEffect(() => {
    setDirectory(settings.defaultOutputDirectory || "");
    setProxy(settings.proxy || "");
    setLanguage(settings.language ?? "auto");
  }, [settings.defaultOutputDirectory, settings.proxy, settings.language]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        ...settings,
        defaultOutputDirectory: directory.trim() || null,
        proxy: proxy.trim() || null
      });
      notifications.show({ message: t("settings.saved"), color: "teal" });
    } catch (error) {
      notifications.show({
        message: t("settings.saveFailed", { error: String(error) }),
        color: "red"
      });
    } finally {
      setSaving(false);
    }
  };

  const pickDirectory = async () => {
    const selected = await openDialog({ directory: true });
    if (typeof selected === "string") setDirectory(selected);
  };

  return (
    <Stack gap="lg" maw={760}>
      <div>
        <Text fw={500}>{t("settings.general.outputDirectoryTitle")}</Text>
        <Text size="xs" c="dimmed">
          {t("settings.general.outputDirectoryHint")}
        </Text>
        <FieldWithActions
          mt="sm"
          actions={
            <>
              <Tooltip label={t("common.restoreDefault")}>
                <ActionIcon
                  variant="default"
                  size="input-sm"
                  disabled={!directory}
                  aria-label={t("common.restoreDefault")}
                  onClick={() => setDirectory("")}
                >
                  <IconArrowBackUp size={16} stroke={1.7} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t("common.selectDirectory")}>
                <ActionIcon
                  variant="default"
                  size="input-sm"
                  aria-label={t("settings.general.selectOutputDirectory")}
                  onClick={() => void pickDirectory()}
                >
                  <IconFolderOpen size={16} stroke={1.7} />
                </ActionIcon>
              </Tooltip>
            </>
          }
        >
          <TextInput
            placeholder={t("settings.general.outputDirectoryPlaceholder")}
            value={directory}
            onChange={(event) => setDirectory(event.currentTarget.value)}
          />
        </FieldWithActions>
      </div>

      <div>
        <Text fw={500}>{t("settings.general.proxyTitle")}</Text>
        <Text size="xs" c="dimmed">
          {t("settings.general.proxyHint")}
        </Text>
        <TextInput
          mt="sm"
          placeholder="http://127.0.0.1:7890"
          value={proxy}
          onChange={(event) => setProxy(event.currentTarget.value)}
        />
      </div>

      <div>
        <Text fw={500}>{t("settings.general.themeTitle")}</Text>
        <SegmentedControl
          mt="sm"
          w={320}
          radius="md"
          value={colorScheme}
          onChange={(value) => setColorScheme(value as MantineColorScheme)}
          data={[
            {
              value: "light",
              label: themeOptionLabel(
                <IconSun size={15} stroke={1.7} />,
                t("settings.general.themeLight")
              )
            },
            {
              value: "dark",
              label: themeOptionLabel(
                <IconMoon size={15} stroke={1.7} />,
                t("settings.general.themeDark")
              )
            },
            {
              value: "auto",
              label: themeOptionLabel(
                <IconDeviceDesktop size={15} stroke={1.7} />,
                t("settings.general.themeAuto")
              )
            }
          ]}
        />
      </div>

      <div>
        <Text fw={500}>{t("settings.general.languageTitle")}</Text>
        <SegmentedControl
          mt="sm"
          w={320}
          radius="md"
          value={language}
          onChange={(value) => {
            const choice = value as LanguageChoice;
            setLanguage(choice);
            onSetLanguage(choice);
          }}
          data={[
            {
              value: "zh",
              label: themeOptionLabel(<IconLanguage size={15} stroke={1.7} />, "简体中文")
            },
            {
              value: "en",
              label: themeOptionLabel(<IconWorld size={15} stroke={1.7} />, "English")
            },
            {
              value: "auto",
              label: themeOptionLabel(
                <IconDeviceDesktop size={15} stroke={1.7} />,
                t("settings.general.languageAuto")
              )
            }
          ]}
        />
      </div>

      <Group justify="end">
        <Button
          leftSection={<IconBookDownload size={15} />}
          loading={saving}
          onClick={() => void save()}
        >
          {t("settings.general.save")}
        </Button>
      </Group>
    </Stack>
  );
}
