import {
  ActionIcon,
  Button,
  Card,
  Divider,
  Group,
  Image,
  Stack,
  Text,
  type CardProps
} from "@mantine/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { IconBrandGithub, IconExternalLink, IconRefresh, IconWorld } from "@tabler/icons-react";
import { Fragment, type ReactNode } from "react";
import { notifications } from "../../lib/notifications";
import organizationLogo from "../../assets/organization_logo.png";
import appIcon from "../../../src-tauri/icons/icon.png";
import packageInfo from "../../../package.json";
import { FieldWithActions } from "../../components/common/FieldWithActions";

const GITHUB_URL = "https://github.com/MAD-Producer/MAD-Toolbox";

const TEAM_LINKS = [
  { name: "开发者名单", url: "https://github.com/MAD-Producer/MAD-Toolbox/graphs/contributors" },
  { name: "关于 MAD Producer Studio", url: "https://madproducer.cn/about#module-2339" }
] as const;

const CREDITS = [
  {
    name: "FFmpeg",
    note: "媒体转码与处理核心",
    url: "https://www.ffmpeg.org/"
  },
  {
    name: "yt-dlp",
    note: "提供YouTube视频和大多数网页媒体下载功能",
    url: "https://github.com/yt-dlp/yt-dlp"
  },
  { name: "BBDown", note: "提供Bilibili视频下载功能", url: "https://github.com/nilaoda/BBDown" },
  {
    name: "Musicdl",
    note: "提供多平台音乐搜索与下载功能",
    url: "https://pypi.org/project/musicdl/2.6.1/"
  },
  { name: "Deno", note: "为部分 JavaScript 提供运行时支撑", url: "https://deno.com/" },
  {
    name: "MediaInfo",
    note: "提供媒体元数据探测功能",
    url: "https://github.com/mediaarea/mediainfo"
  }
] as const;

interface AboutListRowProps {
  primary: string;
  secondary?: string;
  leading?: ReactNode;
  href?: string;
}

function AboutListRow({ primary, secondary, leading, href }: AboutListRowProps) {
  return (
    <FieldWithActions
      px="md"
      py="sm"
      actions={
        href && (
          <ActionIcon
            variant="transparent"
            color="gray"
            className="about-action"
            aria-label={`打开 ${primary}`}
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

function AboutSection({
  title,
  cardProps,
  children
}: {
  title: string;
  cardProps?: CardProps;
  children: ReactNode;
}) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        {title}
      </Text>
      <Card withBorder {...(cardProps ?? { p: 0, py: "sm" })}>
        {children}
      </Card>
    </Stack>
  );
}

export function AboutSettingsPage() {
  return (
    <Stack gap="lg">
      <AboutSection title="关于" cardProps={{ p: 24 }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Stack align="center" gap="xs">
            <Group gap="sm" wrap="nowrap" align="center">
              <Image src={appIcon} alt="MAD Toolbox" w={24} h={24} radius="sm" flex="0 0 auto" />
              <Text className="app-title" fz="xl">
                MAD Toolbox
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              Version:{" "}
              <Text span fw={700} inherit>
                v{packageInfo.version}
              </Text>
            </Text>
          </Stack>
          <Group gap="sm" wrap="nowrap">
            <Button
              variant="transparent"
              color="gray"
              className="about-action"
              leftSection={<IconWorld size={16} />}
              onClick={() => void openUrl(GITHUB_URL)}
            >
              Website
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
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={() => notifications.show({ message: "已是最新版本", color: "green" })}
            >
              Check for update
            </Button>
          </Group>
        </Group>
      </AboutSection>

      <AboutSection title="开发团队">
        <Image src={organizationLogo} alt="MAD Producer Studio" h={96} w="auto" mx="auto" my="sm" />
        <Group grow px="md" gap="sm">
          {TEAM_LINKS.map((link) => (
            <Button
              key={link.url}
              variant="default"
              leftSection={<IconExternalLink size={16} stroke={1.7} />}
              onClick={() => void openUrl(link.url)}
            >
              {link.name}
            </Button>
          ))}
        </Group>
      </AboutSection>

      <AboutSection title="致谢">
        {CREDITS.map((item, index) => (
          <Fragment key={item.name}>
            {index > 0 && <Divider />}
            <AboutListRow primary={item.name} secondary={item.note} href={item.url} />
          </Fragment>
        ))}
      </AboutSection>

      <AboutSection title="法律信息">
        <AboutListRow primary="版权" secondary="Copyright © 2026 MAD Producer Studio" />
        <Divider />
        <AboutListRow primary="开源协议" secondary="MIT License" />
      </AboutSection>

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
