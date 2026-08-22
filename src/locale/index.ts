/**
 * i18n 核心：i18next 为引擎（复数、运行时 changeLanguage、事件），本模块做三件事——
 * 1. 以 zh.json/en.json 为资源初始化（keySeparator:false，键为不透明扁平字符串）
 * 2. 语言选择管理：可选值 auto/zh/en 持久化到 localStorage（镜像后端 settings.language，
 *    localStorage 让启动首屏即时命中正确语言，后端为真相源，加载后由 App 对账）
 * 3. 导出纯函数 t() 包装（键类型由 zh.json 推导，调用方无需 hook，模块级/运行期均可调用；
 *    组件在语言切换后由 App 层整体重挂载取到新译文）
 */
import i18next from "i18next";
import zh from "./zh.json";
import en from "./en.json";

export type Locale = "zh" | "en";

/** 用户可选的语言设置：auto = 跟随系统 */
export type LanguageChoice = "auto" | "zh" | "en";

export type TranslationKey = keyof typeof zh;

const STORAGE_KEY = "mad-toolbox:language";

const LANGUAGE_BY_CHOICE: Record<LanguageChoice, Locale> = {
  auto: "zh",
  zh: "zh",
  en: "en"
};

/** locale 以 zh 开头（含繁中）→ 中文，其余 → 英文；与后端 core/language.rs 同方案 */
function detectSystemLocale(): Locale {
  const tag = (navigator.language || navigator.languages?.[0] || "en")
    .replace("_", "-")
    .toLowerCase();
  return tag.startsWith("zh") ? "zh" : "en";
}

export function resolveChoice(choice: LanguageChoice): Locale {
  return choice === "auto" ? detectSystemLocale() : LANGUAGE_BY_CHOICE[choice];
}

function readStoredChoice(): LanguageChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "zh" || value === "en" ? value : "auto";
  } catch {
    return "auto";
  }
}

void i18next.init({
  resources: {
    zh: { translation: zh },
    en: { translation: en }
  },
  lng: resolveChoice(readStoredChoice()),
  fallbackLng: "en",
  // 键本身含点号（如 "nav.tasks"），不做嵌套/命名空间切分；复数后缀 _one/_other 仍生效
  keySeparator: false,
  nsSeparator: false,
  // React 渲染的文本由 React 转义；命令预览等纯字符串场景也不需要 HTML 实体
  interpolation: { escapeValue: false }
});

export function languageChoice(): LanguageChoice {
  return readStoredChoice();
}

export function currentLanguage(): Locale {
  return i18next.language?.startsWith("zh") ? "zh" : "en";
}

/** 应用语言选择：写 localStorage 并切换 i18next；后端同步由调用方 invoke set_language */
export function setLanguageChoice(choice: LanguageChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // localStorage 不可用（隐私模式等）时本次会话仍可切换
  }
  void i18next.changeLanguage(resolveChoice(choice));
  document.documentElement.lang = currentLanguage();
}

/** 语言变化订阅（App 层据此重挂载内容区），返回取消函数 */
export function onLanguageChanged(listener: () => void): () => void {
  i18next.on("languageChanged", listener);
  return () => i18next.off("languageChanged", listener);
}

/** 数组参数按语言选取列表连接符（中文顿号 / 英文逗号空格） */
function joinList(items: readonly (string | number)[]): string {
  return items.map(String).join(currentLanguage() === "zh" ? "、" : ", ");
}

/** 取译文并做 {name} 插值；传 count 时走 i18next 复数（en 的 _one/_other 键）。 */
export function t(
  key: TranslationKey,
  params?: Record<string, string | number | readonly (string | number)[]>
): string {
  if (!params) return i18next.t(key, { defaultValue: key }) as string;
  const flat = Object.fromEntries(
    Object.entries(params).map(([name, value]) => [
      name,
      Array.isArray(value) ? joinList(value) : value
    ])
  );
  return i18next.t(key, { ...flat, defaultValue: key }) as string;
}

// 启动即对齐 <html lang>；后续变化由 setLanguageChoice 维护
document.documentElement.lang = currentLanguage();
