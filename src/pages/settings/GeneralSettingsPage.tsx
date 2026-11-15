import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  ArrowCounterClockwise,
  FloppyDisk,
  Desktop,
  FolderOpen,
  GlobeHemisphereWest,
  Moon,
  Plus,
  Sun,
  Trash,
  Globe
} from "@phosphor-icons/react";
import { useState } from "react";
import { FieldWithActions } from "../../components/common/FieldWithActions";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { Segmented } from "../../components/ui/segmented";
import { Separator } from "../../components/ui/separator";
import { Tooltip } from "../../components/ui/tooltip";
import type { CookieFileOption } from "../../contracts/types";
import { useColorScheme, type ColorScheme } from "../../lib/theme";
import { notifications } from "../../lib/notifications";
import { t, type LanguageChoice } from "../../locale";
import type { AppSettings, GeneralSettingsDraft } from "./api";
import { SettingsRow, SettingsSectionCard } from "./SettingsBlocks";

interface GeneralSettingsPageProps {
  settings: AppSettings;
  onSave: (settings: GeneralSettingsDraft) => Promise<AppSettings>;
  onSetLanguage: (choice: LanguageChoice) => Promise<void>;
}

export function GeneralSettingsPage({ settings, onSave, onSetLanguage }: GeneralSettingsPageProps) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [directory, setDirectory] = useState(settings.defaultOutputDirectory || "");
  const [proxy, setProxy] = useState(settings.proxy || "");
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState<LanguageChoice>(settings.language ?? "auto");
  const [changingLanguage, setChangingLanguage] = useState(false);
  const [cookieFiles, setCookieFiles] = useState<CookieFileOption[]>(settings.cookieFiles);

  const draft: GeneralSettingsDraft = {
    defaultOutputDirectory: directory.trim() || null,
    proxy: proxy.trim() || null,
    cookieFiles: cookieFiles.map((cookieFile) => ({
      alias: cookieFile.alias.trim(),
      path: cookieFile.path.trim()
    }))
  };
  const dirty =
    draft.defaultOutputDirectory !== settings.defaultOutputDirectory ||
    draft.proxy !== settings.proxy ||
    draft.cookieFiles.length !== settings.cookieFiles.length ||
    draft.cookieFiles.some(
      (cookieFile, index) =>
        cookieFile.alias !== settings.cookieFiles[index]?.alias ||
        cookieFile.path !== settings.cookieFiles[index]?.path
    );

  // 乐观更新 + 失败就地回滚（原先靠 Effect 在 changingLanguage 复位时把
  // settings.language 镜像回本地；语言写入路径只有这里，等价且更直接）
  const changeLanguage = async (choice: LanguageChoice) => {
    if (changingLanguage || choice === language) return;
    const previous = language;
    setLanguage(choice);
    setChangingLanguage(true);
    try {
      await onSetLanguage(choice);
    } catch (error) {
      setLanguage(previous);
      notifications.show({
        message: t("settings.saveFailed", { error: String(error) }),
        color: "red"
      });
    } finally {
      setChangingLanguage(false);
    }
  };

  const save = async () => {
    if (saving || !dirty) return;
    if (
      draft.cookieFiles.some((cookieFile) => !cookieFile.alias.trim() || !cookieFile.path.trim())
    ) {
      notifications.show({ message: t("settings.general.cookieFilesIncomplete"), color: "yellow" });
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="general-settings-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-auto pb-5">
        <SettingsSectionCard>
          <SettingsRow title={t("settings.general.themeTitle")}>
            <Segmented
              className="w-80"
              aria-label={t("settings.general.themeTitle")}
              value={colorScheme}
              onChange={(value) => setColorScheme(value as ColorScheme)}
              options={[
                {
                  value: "light",
                  icon: <Sun size={15} />,
                  label: t("settings.general.themeLight")
                },
                {
                  value: "dark",
                  icon: <Moon size={15} />,
                  label: t("settings.general.themeDark")
                },
                {
                  value: "auto",
                  icon: <Desktop size={15} />,
                  label: t("settings.general.themeAuto")
                }
              ]}
            />
          </SettingsRow>
          <Separator />
          <SettingsRow title={t("settings.general.languageTitle")}>
            <Segmented
              className="w-80"
              aria-label={t("settings.general.languageTitle")}
              value={language}
              disabled={changingLanguage}
              onChange={(value) => void changeLanguage(value as LanguageChoice)}
              options={[
                { value: "zh", icon: <GlobeHemisphereWest size={15} />, label: "简体中文" },
                { value: "en", icon: <Globe size={15} />, label: "English" },
                {
                  value: "auto",
                  icon: <Desktop size={15} />,
                  label: t("settings.general.languageAuto")
                }
              ]}
            />
          </SettingsRow>
        </SettingsSectionCard>

        <SettingsSectionCard>
          <SettingsRow
            title={t("settings.general.outputDirectoryTitle")}
            description={t("settings.general.outputDirectoryHint")}
          >
            <FieldWithActions
              className="w-[360px]"
              actions={
                <>
                  <Tooltip label={t("common.restoreDefault")}>
                    <span className="inline-flex">
                      <IconButton
                        label={t("common.restoreDefault")}
                        variant="outline"
                        size="sm"
                        disabled={directory === (settings.defaultOutputDirectory ?? "")}
                        onClick={() => setDirectory(settings.defaultOutputDirectory ?? "")}
                      >
                        <ArrowCounterClockwise size={16} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip label={t("settings.general.selectOutputDirectory")}>
                    <span className="inline-flex">
                      <IconButton
                        label={t("settings.general.selectOutputDirectory")}
                        variant="outline"
                        size="sm"
                        onClick={() => void pickDirectory()}
                      >
                        <FolderOpen size={16} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </>
              }
            >
              <Input
                aria-label={t("settings.general.outputDirectoryTitle")}
                placeholder={t("settings.general.outputDirectoryPlaceholder")}
                value={directory}
                onChange={(event) => setDirectory(event.currentTarget.value)}
              />
            </FieldWithActions>
          </SettingsRow>
          <Separator />
          <SettingsRow
            title={t("settings.general.proxyTitle")}
            description={t("settings.general.proxyHint")}
          >
            <Input
              className="w-[360px]"
              aria-label={t("settings.general.proxyTitle")}
              placeholder="http://127.0.0.1:7890"
              value={proxy}
              onChange={(event) => setProxy(event.currentTarget.value)}
            />
          </SettingsRow>
        </SettingsSectionCard>

        <SettingsSectionCard>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("settings.general.cookieFilesTitle")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("settings.general.cookieFilesHint")}
                </p>
              </div>
              <Button
                variant="outline"
                className="h-8 shrink-0 gap-1.5 px-2 text-xs"
                leftSection={<Plus size={14} />}
                onClick={() => setCookieFiles((current) => [...current, { alias: "", path: "" }])}
              >
                {t("settings.general.cookieFilesAdd")}
              </Button>
            </div>
            {cookieFiles.map((cookieFile, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  className="w-40 shrink-0"
                  aria-label={t("settings.general.cookieFilesAlias")}
                  placeholder={t("settings.general.cookieFilesAlias")}
                  value={cookieFile.alias}
                  onChange={(event) =>
                    updateCookieFile(index, { alias: event.currentTarget.value })
                  }
                />
                <FieldWithActions
                  className="min-w-0 flex-1"
                  actions={
                    <>
                      <Tooltip label={t("common.selectCookieFile")}>
                        <span className="inline-flex">
                          <IconButton
                            label={t("common.selectCookieFile")}
                            variant="outline"
                            size="sm"
                            onClick={() => void pickCookieFile(index)}
                          >
                            <FolderOpen size={16} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip label={t("settings.general.cookieFilesRemove")}>
                        <span className="inline-flex">
                          <IconButton
                            label={t("settings.general.cookieFilesRemove")}
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              setCookieFiles((current) =>
                                current.filter((_, itemIndex) => itemIndex !== index)
                              )
                            }
                          >
                            <Trash size={16} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  }
                >
                  <Input
                    aria-label={t("settings.general.cookieFilesPath")}
                    placeholder={t("settings.general.cookieFilesPath")}
                    value={cookieFile.path}
                    onChange={(event) =>
                      updateCookieFile(index, { path: event.currentTarget.value })
                    }
                  />
                </FieldWithActions>
              </div>
            ))}
          </div>
        </SettingsSectionCard>
      </div>
      {(dirty || saving) && (
        <footer className="flex shrink-0 justify-end py-4">
          <Button
            className="gap-1.5"
            leftSection={<FloppyDisk size={16} />}
            loading={saving}
            onClick={() => void save()}
          >
            {t("settings.general.save")}
          </Button>
        </footer>
      )}
    </div>
  );
}
