import {
  TelevisionSimple,
  Stack,
  FilmSlate,
  MusicNotes,
  Globe,
  Lightning,
  type Icon
} from "@phosphor-icons/react";
import type { TranslationKey } from "../locale";
import type { AppSection, MediaPageId, SettingsPageId } from "./route";

export interface L1NavigationItem {
  section: AppSection;
  labelKey: TranslationKey;
  icon: Icon;
}

export interface L2NavigationItem<
  PageId extends MediaPageId | SettingsPageId = MediaPageId | SettingsPageId
> {
  page: PageId;
  labelKey: TranslationKey;
}

/** 导航项的状态徽标（任务运行数 / 依赖缺失数），由侧栏渲染 */
export interface NavigationStatus {
  count: number;
  label: string;
  color: string;
}

/** 侧栏分组：labelKey 为 null 时不渲染分组标题（置顶组） */
export interface SidebarGroup {
  id: string;
  labelKey: TranslationKey | null;
  items: readonly L1NavigationItem[];
}

export const L1_NAVIGATION = [
  { section: "tasks", labelKey: "nav.tasks", icon: Stack },
  { section: "bilibili", labelKey: "nav.bilibili", icon: TelevisionSimple },
  { section: "network", labelKey: "nav.network", icon: Globe },
  { section: "aria2", labelKey: "nav.aria2", icon: Lightning },
  { section: "media", labelKey: "nav.media", icon: FilmSlate },
  { section: "music", labelKey: "nav.music", icon: MusicNotes }
] as const satisfies readonly L1NavigationItem[];

export const SIDEBAR_GROUPS = [
  { id: "main", labelKey: null, items: [L1_NAVIGATION[0]] },
  {
    id: "download",
    labelKey: "nav.groups.download",
    items: [L1_NAVIGATION[1], L1_NAVIGATION[2], L1_NAVIGATION[3]]
  },
  { id: "tools", labelKey: "nav.groups.tools", items: [L1_NAVIGATION[4], L1_NAVIGATION[5]] }
] as const satisfies readonly SidebarGroup[];

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
