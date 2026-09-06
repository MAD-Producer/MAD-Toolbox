import {
  ActionIcon,
  Button,
  Divider,
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
  IconBookDownload,
  IconDeviceDesktop,
  IconFolderOpen,
  IconLanguage,
  IconMoon,
  IconPlus,
  IconSun,
  IconTrash,
  IconWorld
} from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { FieldWithActions } from "../../components/common/FieldWithActions";
import type { CookieFileOption } from "../../contracts/types";
import { t, type LanguageChoice } from "../../locale";
import type { AppSettings } from "./api";
import { SettingsRow, SettingsSectionCard } from "./SettingsBlocks";

interface GeneralSettingsPageProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<AppSettings>;
  onSetLanguage: (choice: LanguageChoice) => void;
}

const CONTROL_WIDTH = 320;

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
  const [cookieFiles, setCookieFiles] = useState<CookieFileOption[]>(settings.cookieFiles);

  useEffect(() => {
    setDirectory(settings.defaultOutputDirectory || "");
    setProxy(settings.proxy || "");
    setLanguage(settings.language ?? "auto");
    setCookieFiles(settings.cookieFiles);
  }, [settings.cookieFiles, settings.defaultOutputDirectory, settings.proxy, settings.language]);

  const save = async () => {
    const normalizedCookieFiles = cookieFiles.map((cookieFile) => ({
      alias: cookieFile.alias.trim(),
      path: cookieFile.path.trim()
    }));
    if (normalizedCookieFiles.some((cookieFile) => !cookieFile.alias || !cookieFile.path)) {
      notifications.show({ message: t("settings.general.cookieFilesIncomplete"), color: "yellow" });
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...settings,
        defaultOutputDirectory: directory.trim() || null,
        proxy: proxy.trim() || null,
        cookieFiles: normalizedCookieFiles
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

  const updateCookieFile = (index: number, patch: Partial<CookieFileOption>) => {
    setCookieFiles((current) =>
      current.map((cookieFile, itemIndex) =>
        itemIndex === index ? { ...cookieFile, ...patch } : cookieFile
      )
    );
  };

  const pickCookieFile = async (index: number) => {
    const selected = await openDialog({ multiple: false, directory: false });
    if (typeof selected === "string") updateCookieFile(index, { path: selected });
  };

  return (
    <Stack gap="lg">
      <SettingsSectionCard>
        <SettingsRow
          title={t("settings.general.outputDirectoryTitle")}
          description={t("settings.general.outputDirectoryHint")}
        >
          <FieldWithActions
            w={360}
            actions={
              <>
                <Tooltip label={t("common.restoreDefault")}>
                  <ActionIcon
                    variant="default"
                    size="input-sm"
                    disabled={directory === (settings.defaultOutputDirectory ?? "")}
                    aria-label={t("common.restoreDefault")}
                    onClick={() => setDirectory(settings.defaultOutputDirectory ?? "")}
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
        </SettingsRow>
        <Divider />
        <SettingsRow
          title={t("settings.general.proxyTitle")}
          description={t("settings.general.proxyHint")}
        >
          <TextInput
            w={360}
            placeholder="http://127.0.0.1:7890"
            value={proxy}
            onChange={(event) => setProxy(event.currentTarget.value)}
          />
        </SettingsRow>
      </SettingsSectionCard>

      <SettingsSectionCard>
        <Stack gap="md" px="lg" py="md">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text size="sm" fw={500}>
                {t("settings.general.cookieFilesTitle")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("settings.general.cookieFilesHint")}
              </Text>
            </Stack>
            <Button
              variant="default"
              leftSection={<IconPlus size={15} stroke={1.7} />}
              onClick={() => setCookieFiles((current) => [...current, { alias: "", path: "" }])}
            >
              {t("settings.general.cookieFilesAdd")}
            </Button>
          </Group>
          {cookieFiles.map((cookieFile, index) => (
            <Group key={index} gap="sm" wrap="nowrap" align="center">
              <TextInput
                w={160}
                aria-label={t("settings.general.cookieFilesAlias")}
                placeholder={t("settings.general.cookieFilesAlias")}
                value={cookieFile.alias}
                onChange={(event) => updateCookieFile(index, { alias: event.currentTarget.value })}
              />
              <FieldWithActions
                style={{ flex: 1, minWidth: 0 }}
                actions={
                  <>
                    <Tooltip label={t("common.selectCookieFile")}>
                      <ActionIcon
                        variant="default"
                        size="input-sm"
                        aria-label={t("common.selectCookieFile")}
                        onClick={() => void pickCookieFile(index)}
                      >
                        <IconFolderOpen size={16} stroke={1.7} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t("settings.general.cookieFilesRemove")}>
                      <ActionIcon
                        variant="default"
                        size="input-sm"
                        color="red"
                        aria-label={t("settings.general.cookieFilesRemove")}
                        onClick={() =>
                          setCookieFiles((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                      >
                        <IconTrash size={16} stroke={1.7} />
                      </ActionIcon>
                    </Tooltip>
                  </>
                }
              >
                <TextInput
                  aria-label={t("settings.general.cookieFilesPath")}
                  placeholder={t("settings.general.cookieFilesPath")}
                  value={cookieFile.path}
                  onChange={(event) => updateCookieFile(index, { path: event.currentTarget.value })}
                />
              </FieldWithActions>
            </Group>
          ))}
        </Stack>
      </SettingsSectionCard>

      <SettingsSectionCard>
        <SettingsRow title={t("settings.general.themeTitle")}>
          <SegmentedControl
            w={CONTROL_WIDTH}
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
        </SettingsRow>
        <Divider />
        <SettingsRow title={t("settings.general.languageTitle")}>
          <SegmentedControl
            w={CONTROL_WIDTH}
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
        </SettingsRow>
      </SettingsSectionCard>

      <Group justify="flex-end">
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
