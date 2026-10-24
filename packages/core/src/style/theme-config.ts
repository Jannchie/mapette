// 可配置的主题：默认配色在 mapette.css 里（参照 Apple 地图），这里用类型化的对象覆盖其中任意几项。
// 可以全局应用（applyTheme(document.documentElement, …)），也可以只作用于某一张地图（MapView 的 theme）。
import { PALETTE_KEYS, paletteVar } from "./palette";

/** 面板与控件的颜色 */
export const UI_KEYS = ["bg", "bgSolid", "fg", "muted", "line", "hover", "accent", "scrollThumb", "scrollThumbHover", "shadowColor", "shadowEdge"] as const;
export type UiKey = (typeof UI_KEYS)[number];
export type MapKey = (typeof PALETTE_KEYS)[number];

export interface ThemeColors {
  ui?: Partial<Record<UiKey, string>>;
  map?: Partial<Record<MapKey, string>>;
}

/**
 * 一套颜色同时用于亮暗，或者亮暗分别给；没给的项（包括只给了一边时的另一边）沿用默认值。
 * @example
 * applyTheme(document.documentElement, { ui: { accent: "#0a84ff" } })
 * applyTheme(el, { light: { map: { water: "#9cc9ee" } }, dark: { map: { water: "#123456" } } })
 */
export type Theme = ThemeColors | { light?: ThemeColors; dark?: ThemeColors };

/**
 * 内置的几套主题，直接传给 MapView / MapExplorer 的 theme，或者 applyTheme。
 * - neutral：默认配色（mapette.css 里的那套），中性灰
 * - cool：陆地、建筑与小路偏蓝，更接近 Apple 地图
 */
export const themes = {
  neutral: {},
  cool: {
    light: {
      map: {
        land: "#e8eef7",
        urban: "#dfe7f2",
        building: "#cfdaea",
        buildingLine: "#bfcde2",
        road: "#fcfdff",
        roadCasing: "#c5d2e6",
      },
    },
    dark: {
      map: {
        land: "#19202b",
        urban: "#1e2634",
        building: "#273244",
        buildingLine: "#313e53",
        road: "#33405a",
        roadCasing: "#19202b",
      },
    },
  },
} satisfies Record<string, Theme>;

export type ThemeName = keyof typeof themes;

const uiVar = (key: UiKey) => `--mapette-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;

/**
 * 主题 → CSS 变量表，可以直接作为内联样式。
 * 每个颜色是 --x-light / --x-dark 两半组合成的 --x；组合在声明它的元素上求值，
 * 所以这里除了给出的那一半，还要在同一个元素上重新声明组合，没给的另一半从上层继承默认值。
 */
export function themeVars(theme: Theme): Record<string, string> {
  const split = "light" in theme || "dark" in theme;
  const light = split ? (theme as { light?: ThemeColors }).light : (theme as ThemeColors);
  const dark = split ? (theme as { dark?: ThemeColors }).dark : (theme as ThemeColors);
  const out: Record<string, string> = {};
  const add = (name: string, l: string | undefined, d: string | undefined) => {
    if (l === undefined && d === undefined) return;
    if (l !== undefined) out[`${name}-light`] = l;
    if (d !== undefined) out[`${name}-dark`] = d;
    out[name] = `light-dark(var(${name}-light), var(${name}-dark))`;
  };
  for (const k of UI_KEYS) add(uiVar(k), light?.ui?.[k], dark?.ui?.[k]);
  for (const k of PALETTE_KEYS) add(paletteVar(k), light?.map?.[k], dark?.map?.[k]);
  // 阴影由两个颜色组合而成，同样要在这个元素上重新组合
  if ("--mapette-shadow-color" in out || "--mapette-shadow-edge" in out) {
    out["--mapette-shadow"] = "0 0 0 1px var(--mapette-shadow-edge), 0 2px 6px var(--mapette-shadow-color)";
  }
  return out;
}

/** 把主题应用到元素上（作用于它和它里面的地图、面板），返回撤销函数 */
export function applyTheme(el: HTMLElement, theme: Theme): () => void {
  const vars = themeVars(theme);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  return () => {
    for (const k of Object.keys(vars)) el.style.removeProperty(k);
  };
}
