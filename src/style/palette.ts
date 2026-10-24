// 配色只在 meisho.css 里定义一份（--meisho-map-* 与 --meisho-accent），这里按当前亮暗模式读出来交给 maplibre。
// 使用方覆盖这些 CSS 变量即可换皮肤，不用改 TS。

export const PALETTE_KEYS = [
  "land", "urban", "wood", "grass", "park", "sand", "water", "building", "buildingLine", "road", "roadCasing",
  "major", "majorCasing", "motorway", "motorwayCasing", "rail", "label", "labelMuted", "waterLabel",
  "focusRing", "space", "horizon", "depthShelf", "depthMid", "depthDeep", "hillshadeShadow", "hillshadeHighlight",
  "heat1", "heat2", "heat3", "heat4", "heat5",
] as const;

export type Palette = Record<(typeof PALETTE_KEYS)[number] | "accent", string>;

/** heatShelf → --meisho-map-heat-shelf，heat1 → --meisho-map-heat-1 */
export const paletteVar = (key: (typeof PALETTE_KEYS)[number]) =>
  `--meisho-map-${key.replace(/[A-Z]|\d/g, (m) => `-${m.toLowerCase()}`)}`;

/**
 * 读出当前生效的配色。变量里是 light-dark(…)，要挂到一个元素的 color 上才会求值成具体的 rgb()，
 * 所以探针挂在 root 里面（默认 body），继承那里的 color-scheme。
 */
export function readPalette(root: HTMLElement = document.body): Palette {
  const probe = document.createElement("span");
  probe.style.display = "none";
  root.appendChild(probe);
  const read = (name: string) => {
    probe.style.color = `var(${name})`;
    return getComputedStyle(probe).color;
  };
  const palette = { accent: read("--meisho-accent") } as Palette;
  for (const key of PALETTE_KEYS) palette[key] = read(paletteVar(key));
  probe.remove();
  return palette;
}
