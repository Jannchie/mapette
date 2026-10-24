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
 * - warm：纸张一样的米色，暖调的水和绿地
 * - mono：去掉颜色的灰阶，让地图上的照片、标记成为主角
 * 每套都分亮暗两半，跟随页面的亮暗模式
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
  warm: {
    light: {
      map: {
        land: "#f5f0e6",
        urban: "#eee6d8",
        building: "#e4d9c6",
        buildingLine: "#d7cab3",
        road: "#fffdf8",
        roadCasing: "#e0d4bf",
        majorCasing: "#d8c9ae",
        wood: "#cfe2bf",
        grass: "#dceacb",
        park: "#c6dfb2",
        water: "#b4d4e1",
        depthShelf: "#a2c8d8",
        depthMid: "#7eaec4",
        depthDeep: "#4f86a3",
        waterLabel: "#4a7f99",
        label: "#4a4036",
        labelMuted: "#958a7c",
        space: "#efe7da",
        horizon: "#e6dccb",
      },
    },
    dark: {
      map: {
        land: "#25211c",
        urban: "#2b2620",
        building: "#383128",
        buildingLine: "#433a2f",
        road: "#453d33",
        roadCasing: "#25211c",
        major: "#544a3e",
        majorCasing: "#25211c",
        wood: "#263325",
        grass: "#2a3427",
        park: "#2a3a27",
        water: "#1f3440",
        depthShelf: "#1b2f3a",
        depthMid: "#142430",
        depthDeep: "#0c1820",
        waterLabel: "#7aa5bb",
        label: "#eee6da",
        labelMuted: "#a49886",
        space: "#0d0b09",
        horizon: "#3a2f24",
      },
    },
  },
  mono: {
    light: {
      map: {
        land: "#f4f4f4",
        urban: "#ececec",
        building: "#e0e0e0",
        buildingLine: "#d2d2d2",
        road: "#ffffff",
        roadCasing: "#d9d9d9",
        majorCasing: "#cccccc",
        motorway: "#ffffff",
        motorwayCasing: "#bdbdbd",
        wood: "#e3e6e3",
        grass: "#e8eae8",
        park: "#dfe3df",
        sand: "#efefea",
        water: "#d0d6dc",
        depthShelf: "#c6cdd4",
        depthMid: "#b4bdc6",
        depthDeep: "#9aa5b0",
        waterLabel: "#7c8791",
        rail: "#c2c2c2",
        space: "#ebebeb",
        horizon: "#dedede",
      },
    },
    dark: {
      map: {
        land: "#1c1c1e",
        urban: "#222224",
        building: "#2c2c2e",
        buildingLine: "#353537",
        road: "#3a3a3c",
        roadCasing: "#1c1c1e",
        major: "#48484a",
        majorCasing: "#1c1c1e",
        motorway: "#545456",
        motorwayCasing: "#1c1c1e",
        wood: "#232625",
        grass: "#242726",
        park: "#252927",
        sand: "#2a2a27",
        water: "#16191c",
        depthShelf: "#14171a",
        depthMid: "#101315",
        depthDeep: "#0a0c0e",
        waterLabel: "#8b949c",
        rail: "#4a4a4c",
        space: "#060606",
        horizon: "#2a2a2c",
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
