import { useCallback, useSyncExternalStore } from "react";

/**
 * 全局色彩主题管理（Design System 唯一真源）。
 * - 三态选择：light / dark / auto（跟随系统），与旧 Mantine 行为一致
 * - 存储：localStorage `mad-toolbox:color-scheme`，首启从 Mantine 旧 key 迁移（读侧保留）
 * - 应用：<html> 切换 `.dark` class（Tailwind dark: 变体，按 resolved 值）
 * - auto 模式下监听系统 prefers-color-scheme 变化实时切换
 */
export type ColorScheme = "light" | "dark" | "auto";
export type ResolvedColorScheme = "light" | "dark";

const STORAGE_KEY = "mad-toolbox:color-scheme";
/** 旧 Mantine 默认 colorSchemeManager 的存储 key（MantineProvider 未自定义 manager） */
const LEGACY_MANTINE_KEY = "mantine-color-scheme-value";

function isColorScheme(value: string | null): value is ColorScheme {
  return value === "light" || value === "dark" || value === "auto";
}

function readStoredScheme(): ColorScheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isColorScheme(stored)) return stored;
    const legacy = localStorage.getItem(LEGACY_MANTINE_KEY);
    if (isColorScheme(legacy)) {
      // 一次性迁移：立即持久化到新 key。否则旧 key 会被 applyScheme 覆写为已解析值，
      // 用户显式选择的 auto 偏好会在第二次启动时静默丢失。
      try {
        localStorage.setItem(STORAGE_KEY, legacy);
      } catch {
        // 忽略写入失败
      }
      return legacy;
    }
  } catch {
    // localStorage 不可用（如隐私模式）时回落浅色
  }
  return "light";
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

let currentScheme: ColorScheme = readStoredScheme();
let systemDark = systemPrefersDark();
const listeners = new Set<() => void>();

export function resolveColorScheme(scheme: ColorScheme, systemIsDark: boolean): ResolvedColorScheme {
  if (scheme === "auto") return systemIsDark ? "dark" : "light";
  return scheme;
}

let currentResolved: ResolvedColorScheme = resolveColorScheme(currentScheme, systemDark);

function applyScheme(scheme: ColorScheme, systemIsDark: boolean) {
  const resolved = resolveColorScheme(scheme, systemIsDark);
  currentResolved = resolved;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function setColorScheme(scheme: ColorScheme) {
  if (scheme === currentScheme) return;
  currentScheme = scheme;
  try {
    localStorage.setItem(STORAGE_KEY, scheme);
  } catch {
    // 忽略写入失败，仅本次会话生效
  }
  applyScheme(currentScheme, systemDark);
  listeners.forEach((listener) => listener());
}

/** 在 React 挂载前调用，确保 html 属性与存储值同步（配合 index.html 的内联防闪脚本） */
export function initTheme() {
  applyScheme(currentScheme, systemDark);
  if (typeof window !== "undefined" && window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", (event) => {
      systemDark = event.matches;
      applyScheme(currentScheme, systemDark);
      listeners.forEach((listener) => listener());
    });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useColorScheme() {
  const scheme = useSyncExternalStore(
    subscribe,
    () => currentScheme,
    () => "light" as ColorScheme
  );
  const resolved = useSyncExternalStore(
    subscribe,
    () => currentResolved,
    () => "light" as ResolvedColorScheme
  );
  const setColor = useCallback((next: ColorScheme) => setColorScheme(next), []);
  return { colorScheme: scheme, resolvedColorScheme: resolved, setColorScheme: setColor };
}
