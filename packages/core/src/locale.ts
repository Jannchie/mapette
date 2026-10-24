// 界面语言：简体、繁体、日语、英语，以及按路径前缀切换语言的约定（简体中文没有前缀，其余是 /zh-hant、/ja、/en）。
// mapette 自带组件的文字（按钮的无障碍名称、页脚、快捷键说明）也在这里，站点不用再翻译一遍。
import type { Locale } from "./style/basemap";

export const LOCALES = ["zh-Hans", "zh-Hant", "ja", "en"] as const satisfies readonly Locale[];

/** 语言选择器里显示各自的本名，不需要翻译 */
export const LOCALE_NAMES: Record<Locale, string> = {
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  ja: "日本語",
  en: "English",
};

/** 各语言的路径前缀 */
export const LOCALE_PREFIX: Record<Locale, string> = { "zh-Hans": "", "zh-Hant": "/zh-hant", ja: "/ja", en: "/en" };

/** URL 第一段（如 "ja"）→ 语言；不是语言前缀时返回 null */
export function localeFromSegment(segment: string | undefined): Locale | null {
  return LOCALES.find((l) => l !== "zh-Hans" && LOCALE_PREFIX[l] === `/${segment?.toLowerCase()}`) ?? null;
}

/** 去掉语言前缀后的路径（"/ja/b/1" → "/b/1"） */
export function stripLocale(pathname: string): string {
  const first = pathname.split("/")[1];
  return localeFromSegment(first) ? pathname.slice(first.length + 1) || "/" : pathname;
}

/** 某语言下的路径（"/b/1" → "/ja/b/1"） */
export const localePath = (locale: Locale, path: string) => `${LOCALE_PREFIX[locale]}${path === "/" && LOCALE_PREFIX[locale] ? "" : path}` || "/";

/** 换语言就是去另一种语言的同一个页面，查询参数与视野（#map）都保留 */
export function switchLocaleUrl(next: Locale, loc: { pathname: string; search: string; hash: string } = location): string {
  return localePath(next, stripLocale(loc.pathname)) + loc.search + loc.hash;
}

/** mapette 自带组件的文字 */
export interface KitText {
  locate: string;
  zoomIn: string;
  zoomOut: string;
  resetNorth: string;
  close: string;
  back: string;
  credits: string;
  source: string;
  shortcuts: string;
  language: string;
  themeAuto: string;
  themeLight: string;
  themeDark: string;
  /** 快捷键说明里的条目 */
  kbZoom: string;
  kbTheme: string;
  /** 气泡菜单 */
  places: (n: number) => string;
  more: (n: number) => string;
  zoomInHere: string;
  /** PWA 更新提示（UpdateToast） */
  updateReady: string;
  reload: string;
  later: string;
}

const fmt = (locale: Locale, n: number) => n.toLocaleString(locale);

export const KIT_TEXT: Record<Locale, KitText> = {
  "zh-Hans": {
    locate: "定位",
    zoomIn: "放大",
    zoomOut: "缩小",
    resetNorth: "指北",
    close: "关闭",
    back: "返回",
    credits: "数据来源与授权",
    source: "源代码",
    shortcuts: "键盘快捷键",
    language: "语言",
    themeAuto: "外观：跟随系统",
    themeLight: "外观：浅色",
    themeDark: "外观：深色",
    kbZoom: "放大 / 缩小",
    kbTheme: "切换外观",
    places: (n) => `${fmt("zh-Hans", n)} 个地点`,
    more: (n) => `另有 ${fmt("zh-Hans", n)} 个`,
    zoomInHere: "放大查看",
    updateReady: "有新版本可用",
    reload: "刷新",
    later: "稍后",
  },
  "zh-Hant": {
    locate: "定位",
    zoomIn: "放大",
    zoomOut: "縮小",
    resetNorth: "指北",
    close: "關閉",
    back: "返回",
    credits: "資料來源與授權",
    source: "原始碼",
    shortcuts: "鍵盤快速鍵",
    language: "語言",
    themeAuto: "外觀：跟隨系統",
    themeLight: "外觀：淺色",
    themeDark: "外觀：深色",
    kbZoom: "放大 / 縮小",
    kbTheme: "切換外觀",
    places: (n) => `${fmt("zh-Hant", n)} 個地點`,
    more: (n) => `另有 ${fmt("zh-Hant", n)} 個`,
    zoomInHere: "放大查看",
    updateReady: "有新版本可用",
    reload: "重新整理",
    later: "稍後",
  },
  ja: {
    locate: "現在地",
    zoomIn: "拡大",
    zoomOut: "縮小",
    resetNorth: "北を上に",
    close: "閉じる",
    back: "戻る",
    credits: "データ出典・ライセンス",
    source: "ソースコード",
    shortcuts: "キーボードショートカット",
    language: "言語",
    themeAuto: "外観：システムに合わせる",
    themeLight: "外観：ライト",
    themeDark: "外観：ダーク",
    kbZoom: "拡大 / 縮小",
    kbTheme: "外観を切り替え",
    places: (n) => `${fmt("ja", n)} か所`,
    more: (n) => `ほか ${fmt("ja", n)} か所`,
    zoomInHere: "拡大して見る",
    updateReady: "新しいバージョンがあります",
    reload: "更新",
    later: "あとで",
  },
  en: {
    locate: "My location",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    resetNorth: "Reset north",
    close: "Close",
    back: "Back",
    credits: "Sources and licenses",
    source: "Source code",
    shortcuts: "Keyboard shortcuts",
    language: "Language",
    themeAuto: "Appearance: system",
    themeLight: "Appearance: light",
    themeDark: "Appearance: dark",
    kbZoom: "Zoom in / out",
    kbTheme: "Switch appearance",
    places: (n) => `${fmt("en", n)} places`,
    more: (n) => `${fmt("en", n)} more`,
    zoomInHere: "Zoom in",
    updateReady: "A new version is available",
    reload: "Reload",
    later: "Later",
  },
};

export const kitText = (locale: Locale | undefined): KitText => KIT_TEXT[locale ?? "en"];

/** 快捷键说明的通用条目（MapExplorer 内置的那些）；站点在前后加上自己的 */
export function baseShortcuts(locale: Locale | undefined): { keys: string[]; label: string }[] {
  const t = kitText(locale);
  return [
    { keys: ["+", "−"], label: t.kbZoom },
    { keys: ["L"], label: t.locate },
    { keys: ["N"], label: t.resetNorth },
    { keys: ["T"], label: t.kbTheme },
    { keys: ["?"], label: t.shortcuts },
  ];
}
