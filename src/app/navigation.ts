import {
  IconBrandBilibili,
  IconListCheck,
  IconMovie,
  IconMusic,
  IconWorldDownload,
  type Icon as TablerIcon
} from "@tabler/icons-react";
import type { TranslationKey } from "../locale";
import type { AppSection, MediaPageId, SettingsPageId } from "./route";

export interface L1NavigationItem {
  section: AppSection;
  labelKey: TranslationKey;
  icon: TablerIcon;
}

export interface L2NavigationItem<
  PageId extends MediaPageId | SettingsPageId = MediaPageId | SettingsPageId
> {
  page: PageId;
  labelKey: TranslationKey;
  icon?: TablerIcon;
}

// 设置不属于 L1 导航：入口在顶栏标题右侧（AppShell），为独立设置界面预留
export const L1_NAVIGATION = [
  { section: "tasks", labelKey: "nav.tasks", icon: IconListCheck },
  { section: "bilibili", labelKey: "nav.bilibili", icon: IconBrandBilibili },
  { section: "network", labelKey: "nav.network", icon: IconWorldDownload },
  { section: "media", labelKey: "nav.media", icon: IconMovie },
  { section: "music", labelKey: "nav.music", icon: IconMusic }
] as const satisfies readonly L1NavigationItem[];

export const MEDIA_L2_NAVIGATION = [
  { page: "pr-compatible", labelKey: "nav.media.prCompatible" },
  { page: "transcode", labelKey: "nav.media.transcode" },
  { page: "remux", labelKey: "nav.media.remux" },
  { page: "extract", labelKey: "nav.media.extract" },
  { page: "gif", labelKey: "nav.media.gif" },
  { page: "image-export", labelKey: "nav.media.imageExport" }
] as const satisfies readonly L2NavigationItem<MediaPageId>[];

export const SETTINGS_L2_NAVIGATION = [
  { page: "general", labelKey: "nav.settings.general" },
  { page: "dependencies", labelKey: "nav.settings.dependencies" },
  { page: "about", labelKey: "nav.settings.about" }
] as const satisfies readonly L2NavigationItem<SettingsPageId>[];

export const L2_NAVIGATION = {
  media: MEDIA_L2_NAVIGATION,
  settings: SETTINGS_L2_NAVIGATION
} as const;
