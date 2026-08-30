import {
  ActionIcon,
  Button,
  Box,
  Divider,
  Group,
  Image,
  SegmentedControl,
  Stack,
  Text,
  Tooltip
} from "@mantine/core";
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
import appIcon from "../../assets/logo.png";
import packageInfo from "../../../package.json";
import { FieldWithActions } from "../../components/common/FieldWithActions";
import { t, type TranslationKey } from "../../locale";
import { checkForUpdate, installUpdate, type UpdateCheck } from "./api";
import { SettingsRow, SettingsSectionCard } from "./SettingsBlocks";

type DownloadSource = "github" | "mirror";

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

function AboutListRow({ primary, secondary, leading, href }: AboutListRowProps) {
  return (
    <FieldWithActions
      px="lg"
      py="sm"
      actions={
        href && (
          <ActionIcon
            variant="transparent"
            color="gray"
            className="about-action"
            aria-label={t("settings.about.openLink", { name: primary })}
            onClick={() => void openUrl(href)}
          >
            <IconExternalLink size={16} stroke={1.7} />
          </ActionIcon>
        )
      }
    >
      <Group gap="sm" wrap="nowrap">
        {leading}
        <div style={{ minWidth: 0 }}>
          <Text size="sm" fw={500}>
            {primary}
          </Text>
          {secondary && (
            <Text size="xs" c="dimmed">
              {secondary}
            </Text>
          )}
        </div>
      </Group>
    </FieldWithActions>
  );
}

export function AboutSettingsPage() {
  const [checking, setChecking] = useState(false);
  const [source, setSource] = useState<DownloadSource>("github");
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
      await installUpdate(source === "mirror");
    } catch (error) {
      notifications.show({ message: String(error), color: "red" });
    } finally {
      finishDownload();
    }
  }

  return (
    <Stack gap="lg">
      <SettingsSectionCard title={t("settings.about.title")}>
        <Box p="lg">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="lg" wrap="nowrap" align="center">
              <Image src={appIcon} alt="MAD Toolbox" h={64} w="auto" radius="sm" flex="0 0 auto" />
              <Stack gap={8}>
                <Text className="app-title">MAD Toolbox</Text>
                <Text size="sm" fw={600}>
                  v{packageInfo.version}
                </Text>
              </Stack>
            </Group>
            <Group gap="sm" wrap="nowrap">
              <Button
                variant="transparent"
                color="gray"
                className="about-action"
                leftSection={<IconWorld size={16} />}
                onClick={() => void openUrl(TOOLBOX_URL)}
              >
                {t("settings.about.website")}
              </Button>
              <Button
                variant="transparent"
                color="gray"
                className="about-action"
                leftSection={<IconBrandGithub size={16} />}
                onClick={() => void openUrl(GITHUB_URL)}
              >
                GitHub
              </Button>
              {update ? (
                <Group gap="sm" wrap="nowrap">
                  <Tooltip
                    label={
                      downloading
                        ? progress !== null
                          ? t("settings.about.downloadingProgress", { percent: progress })
                          : t("settings.about.downloading")
                        : t("settings.about.updateToVersion", { version: update.latestVersion })
                    }
                    opened={downloading || undefined}
                    position="bottom"
                  >
                    <ActionIcon
                      size="input-sm"
                      variant="filled"
                      color="green"
                      loading={downloading}
                      aria-label={t("settings.about.updateToVersion", {
                        version: update.latestVersion
                      })}
                      onClick={() => void handleDownloadUpdate()}
                    >
                      <IconDownload size={16} stroke={1.7} />
                    </ActionIcon>
                  </Tooltip>
                  <SegmentedControl
                    size="xs"
                    value={source}
                    onChange={(value) => setSource(value as DownloadSource)}
                    disabled={downloading}
                    data={[
                      { value: "github", label: t("settings.about.sourceGithub") },
                      { value: "mirror", label: t("settings.about.sourceMirror") }
                    ]}
                  />
                </Group>
              ) : (
                <Button
                  leftSection={<IconRefresh size={16} />}
                  loading={checking}
                  onClick={() => void handleCheckUpdate()}
                >
                  {t("settings.about.checkUpdate")}
                </Button>
              )}
            </Group>
          </Group>
        </Box>
      </SettingsSectionCard>

      <SettingsSectionCard title={t("settings.about.team")}>
        <Group justify="space-between" align="center" wrap="nowrap" p="lg" gap="lg">
          <Image
            src={organizationLogo}
            alt="MAD Producer Studio"
            w={480}
            h="auto"
            flex="0 0 auto"
            mx="lg"
            my="lg"
          />
          <Stack gap="xl">
            {TEAM_LINKS.map((link) => (
              <Button
                key={link.url}
                variant="transparent"
                color="gray"
                className="about-action"
                leftSection={<IconExternalLink size={16} stroke={1.7} />}
                onClick={() => void openUrl(link.url)}
              >
                {t(link.nameKey)}
              </Button>
            ))}
          </Stack>
        </Group>
      </SettingsSectionCard>

      <SettingsSectionCard title={t("settings.about.credits")}>
        {CREDITS.map((item, index) => (
          <Fragment key={item.name}>
            {index > 0 && <Divider />}
            <AboutListRow primary={item.name} secondary={t(item.noteKey)} href={item.url} />
          </Fragment>
        ))}
      </SettingsSectionCard>

      <SettingsSectionCard title={t("settings.about.legal")}>
        <SettingsRow
          title={t("settings.about.copyright")}
          description="Copyright © 2026 MAD Producer Studio"
        />
        <Divider />
        <SettingsRow title={t("settings.about.license")} description="MIT License" />
      </SettingsSectionCard>

      <Stack align="center" gap="xs" mt="xl">
        <Text fs="italic" ta="center" fz={22} lh={1.8} c="dimmed">
          There are many toolboxes
          <br />
          but this one is for you, <span className="quote-hero-mark">MADer</span>
        </Text>
        <span className="quote-hero-taper" />
        <Text size="sm" c="dimmed" fw={700}>
          MAD Producer Studio
        </Text>
      </Stack>
    </Stack>
  );
}
