import { openUrl } from "@tauri-apps/plugin-opener";
import {
  IconBrandGithub,
  IconDownload,
  IconExternalLink,
  IconRefresh,
  IconWorld
} from "@tabler/icons-react";
import { Fragment, useState, type ReactNode } from "react";
import { notifications } from "../../lib/notifications";
import { useUpdateStore } from "../../stores/update";
import organizationLogo from "../../assets/organization_logo.png";
import frameneoLogo from "../../../assets/FRAMENEO_logo.avif";
import appIcon from "../../assets/logo.png";
import packageInfo from "../../../package.json";
import { FieldWithActions } from "../../components/common/FieldWithActions";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Separator } from "../../components/ui/separator";
import { Tooltip } from "../../components/ui/tooltip";
import { t, type TranslationKey } from "../../locale";
import { checkForUpdate, installUpdate } from "./api";
import { SettingsRow, SettingsSectionCard } from "./SettingsBlocks";

const GITHUB_URL = "https://github.com/MAD-Producer/MAD-Toolbox";
const TOOLBOX_URL = "https://toolbox.madproducer.cn";

const TEAM_LINKS = [
  {
    nameKey: "settings.about.teamDevelopers",
    url: "https://github.com/MAD-Producer/MAD-Toolbox/graphs/contributors"
  },
  { nameKey: "settings.about.teamAboutStudio", url: "https://madproducer.cn/about#module-2339" }
] as const satisfies ReadonlyArray<{ nameKey: TranslationKey; url: string }>;

const CREDITS = [
  {
    name: "FFmpeg",
    noteKey: "settings.about.credit.ffmpeg",
    url: "https://www.ffmpeg.org/"
  },
  {
    name: "yt-dlp",
    noteKey: "settings.about.credit.ytDlp",
    url: "https://github.com/yt-dlp/yt-dlp"
  },
  {
    name: "BBDown",
    noteKey: "settings.about.credit.bbdown",
    url: "https://github.com/nilaoda/BBDown"
  },
  {
    name: "Musicdl",
    noteKey: "settings.about.credit.musicdl",
    url: "https://pypi.org/project/musicdl/2.6.1/"
  },
  { name: "Deno", noteKey: "settings.about.credit.deno", url: "https://deno.com/" },
  {
    name: "MediaInfo",
    noteKey: "settings.about.credit.mediainfo",
    url: "https://github.com/mediaarea/mediainfo"
  }
] as const satisfies ReadonlyArray<{ name: string; noteKey: TranslationKey; url: string }>;

interface AboutListRowProps {
  primary: string;
  secondary?: string;
  leading?: ReactNode;
  href?: string;
}

function updateTooltipLabel(
  update: { latestVersion: string },
  downloading: boolean,
  progress: number | null
): string {
  if (downloading) {
    return progress !== null
      ? t("settings.about.downloadingProgress", { percent: progress })
      : t("settings.about.downloading");
  }
  return t("settings.about.updateToVersion", { version: update.latestVersion });
}

function AboutListRow({ primary, secondary, leading, href }: AboutListRowProps) {
  return (
    <FieldWithActions
      className="px-5 py-3"
      actions={
        href && (
          <Tooltip label={t("settings.about.openLink", { name: primary })}>
            <span className="inline-flex">
              <IconButton
                label={t("settings.about.openLink", { name: primary })}
                variant="ghost"
                size="sm"
                onClick={() => void openUrl(href)}
              >
                <IconExternalLink size={16} stroke={1.8} />
              </IconButton>
            </span>
          </Tooltip>
        )
      }
    >
      <div className="flex items-center gap-3">
        {leading}
        <div className="min-w-0">
          <p className="text-sm font-medium">{primary}</p>
          {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
        </div>
      </div>
    </FieldWithActions>
  );
}

export function AboutSettingsPage() {
  const [checking, setChecking] = useState(false);
  const update = useUpdateStore((state) => state.update);
  const downloading = useUpdateStore((state) => state.downloading);
  const progress = useUpdateStore((state) => state.progress);
  const setUpdate = useUpdateStore((state) => state.setUpdate);
  const startDownload = useUpdateStore((state) => state.startDownload);
  const finishDownload = useUpdateStore((state) => state.finishDownload);

  async function handleCheckUpdate() {
    setChecking(true);
    try {
      const result = await checkForUpdate();
      if (result.updateAvailable) {
        setUpdate(result);
        notifications.show({
          message: t("settings.about.updateFound", { version: result.latestVersion }),
          color: "green"
        });
      } else {
        setUpdate(null);
        notifications.show({ message: t("settings.about.upToDate"), color: "green" });
      }
    } catch (error) {
      notifications.show({ message: String(error), color: "red" });
    } finally {
      setChecking(false);
    }
  }

  async function handleDownloadUpdate() {
    if (!update || downloading) return;
    startDownload();
    try {
      await installUpdate();
    } catch (error) {
      notifications.show({ message: String(error), color: "red" });
    } finally {
      finishDownload();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsSectionCard title={t("settings.about.title")}>
        <div className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <img src={appIcon} alt="MAD Toolbox" className="h-16 w-auto shrink-0 rounded-sm" />
              <div className="flex flex-col gap-2">
                <span className="app-title">MAD Toolbox</span>
                <p className="text-sm font-semibold">v{packageInfo.version}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                className="gap-1.5"
                leftSection={<IconWorld size={16} stroke={1.8} />}
                onClick={() => void openUrl(TOOLBOX_URL)}
              >
                {t("settings.about.website")}
              </Button>
              <Button
                variant="ghost"
                className="gap-1.5"
                leftSection={<IconBrandGithub size={16} stroke={1.8} />}
                onClick={() => void openUrl(GITHUB_URL)}
              >
                GitHub
              </Button>
              {update ? (
                <Tooltip label={updateTooltipLabel(update, downloading, progress)}>
                  <span className="inline-flex">
                    <IconButton
                      label={
                        downloading
                          ? progress !== null
                            ? t("settings.about.downloadingProgress", { percent: progress })
                            : t("settings.about.downloading")
                          : t("settings.about.updateToVersion", { version: update.latestVersion })
                      }
                      variant="primary"
                      size="sm"
                      loading={downloading}
                      onClick={() => void handleDownloadUpdate()}
                    >
                      <IconDownload size={16} stroke={1.8} />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <Button
                  className="gap-1.5"
                  leftSection={<IconRefresh size={16} stroke={1.8} />}
                  loading={checking}
                  onClick={() => void handleCheckUpdate()}
                >
                  {t("settings.about.checkUpdate")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title={t("settings.about.team")}>
        <div className="flex items-center justify-between gap-6 p-5">
          <img
            src={organizationLogo}
            alt="MAD Producer Studio"
            className="mx-5 my-5 w-[480px] max-w-full shrink-0"
          />
          <div className="flex shrink-0 flex-col gap-8">
            {TEAM_LINKS.map((link) => (
              <Button
                key={link.url}
                size="sm"
                variant="ghost"
                className="w-full gap-1.5"
                leftSection={<IconExternalLink size={16} stroke={1.8} />}
                onClick={() => void openUrl(link.url)}
              >
                {t(link.nameKey)}
              </Button>
            ))}
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title={t("settings.about.specialThanks")}>
        <div className="flex items-center justify-between gap-6 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={frameneoLogo}
              alt="FRAMENEO"
              className="about-sponsor-logo h-12 w-auto shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">FRAMENEO</p>
              <p className="text-xs text-muted-foreground">{t("settings.about.credit.frameneo")}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="shrink-0 gap-1.5"
            leftSection={<IconExternalLink size={16} stroke={1.8} />}
            onClick={() => void openUrl("https://www.frameneo.com/")}
          >
            {t("settings.about.frameneoWebsite")}
          </Button>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title={t("settings.about.credits")}>
        {CREDITS.map((item, index) => (
          <Fragment key={item.name}>
            {index > 0 && <Separator />}
            <AboutListRow primary={item.name} secondary={t(item.noteKey)} href={item.url} />
          </Fragment>
        ))}
      </SettingsSectionCard>

      <SettingsSectionCard title={t("settings.about.legal")}>
        <SettingsRow
          title={t("settings.about.copyright")}
          description="Copyright © 2026 MAD Producer Studio"
        />
        <Separator />
        <SettingsRow title={t("settings.about.license")} description="MIT License" />
      </SettingsSectionCard>

      <div className="mt-8 flex flex-col items-center gap-2.5">
        <p className="text-center text-[22px] italic leading-[1.8] text-muted-foreground">
          There are many toolboxes
          <br />
          but this one is for you, <span className="quote-hero-mark">MADer</span>
        </p>
        <span className="quote-hero-taper" />
        <p className="text-sm font-bold text-muted-foreground">MAD Producer Studio</p>
      </div>
    </div>
  );
}
