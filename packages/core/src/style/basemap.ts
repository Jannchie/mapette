// 底图：参照 Apple 地图——素净的底、明亮的水与青绿、水深渐变与淡山影、白色道路、暖黄高速、细灰铁路。
// 最早是 junrei（圣地巡礼地图）的地图皮肤，抽出来给各个「地点 + 照片」站点共用。
// 矢量瓦片默认来自 OpenFreeMap（OpenMapTiles schema），只保留找地方用得上的要素：水、绿地、市街地、道路、铁路与车站、地名。
// 刻意不画任何政治要素：没有国界、省界、国名，也没有存在命名争议的海域名称；
// 地名按界面语言显示（与 Apple 地图一致），避免在争议地区显示实际管辖方的文字。
import type { ExpressionSpecification, LayerSpecification, SourceSpecification, StyleSpecification } from "maplibre-gl";
import type { Palette } from "./palette";

/** 地名的显示语言 */
export type Locale = "zh-Hans" | "zh-Hant" | "ja" | "en";

/** 中日文字由浏览器本地字体绘制（与 Apple 地图一致用无衬线体），拉丁字母走 glyph 服务的 Noto Sans */
export const CJK_FONT_FAMILY = "'Hiragino Sans', 'PingFang SC', 'Yu Gothic', 'YuGothic', 'Noto Sans JP', 'Noto Sans CJK JP', sans-serif";

const SOURCE = "openmaptiles";
/** 按线路配色的铁路（PMTiles，schema 见 junrei 的 sync/rail.py）；底图的灰色铁路垫在下面，覆盖不到的地区照常显示 */
const RAIL = "rail";
/** 地形瓦片（Terrarium 编码），含陆地高程与海底水深；只取到 z10，再放大就复用低层级瓦片 */
const DEM = "terrain";
export const FONT = ["Noto Sans Regular"];
export const FONT_BOLD = ["Noto Sans Bold"];
export const FONT_ITALIC = ["Noto Sans Italic"];

/** rgb() 颜色 + 透明度 → rgba()，热力图的色带要在同一个颜色上渐变透明度 */
export function alpha(color: string, a: number) {
  const [r, g, b] = color.match(/[\d.]+/g)!.map(Number);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
const NAME_FIELDS: Record<Locale, string[]> = {
  "zh-Hans": ["name:zh-Hans", "name:zh"],
  "zh-Hant": ["name:zh-Hant", "name:zh"],
  ja: ["name:ja"],
  en: ["name:en", "name:latin"],
};
/** 铁路图层的线路名：n 是当地名称，en、ja、zh 是各语言名称（sync/rail.py 的 schema） */
const RAIL_NAME_FIELDS: Record<Locale, string[]> = { "zh-Hans": ["zh"], "zh-Hant": ["zh"], ja: ["ja"], en: ["en"] };

/** 没有标注颜色的高铁 */
const HS_COLOR = "#1f5fbf";
/** 按线路配色的铁路线宽：高铁 > 普通铁路 > 地铁、轻轨、单轨 > 路面电车 */
const railWidth = (casing: number[] = [0, 0, 0, 0]): ExpressionSpecification => [
  "interpolate", ["exponential", 1.5], ["zoom"],
  4, ["+", casing[0], ["match", ["get", "k"], "hs", 1.6, 0.5]],
  8, ["+", casing[1], ["match", ["get", "k"], "hs", 2.4, "train", 1, 0.6]],
  12, ["+", casing[2], ["match", ["get", "k"], "hs", 3, "train", 2, "tram", 1, 1.6]],
  16, ["+", casing[3], ["match", ["get", "k"], "hs", 5, "train", 4, "tram", 2, 3]],
];

/** 线宽随缩放指数增长 */
const width = (pairs: [number, number][]): ExpressionSpecification =>
  ["interpolate", ["exponential", 1.6], ["zoom"], ...pairs.flat()] as ExpressionSpecification;

export interface BasemapOptions {
  palette: Palette;
  locale?: Locale;
  /** 矢量瓦片（OpenMapTiles schema）的 TileJSON 地址，默认 OpenFreeMap */
  tiles?: string;
  /** glyph 服务，默认 OpenFreeMap */
  glyphs?: string;
  /** 按线路配色的铁路 PMTiles 地址（pmtiles://…），不给就只画底图自带的灰色铁路 */
  rail?: string;
  /** 淡山影与水深，默认开启（AWS 开放地形瓦片） */
  terrain?: boolean;
  /** 球面投影：缩到最小是地球，默认开启 */
  globe?: boolean;
  /** 使用方的数据源 */
  sources?: Record<string, SourceSpecification>;
  /** 插在地名下面的图层（热力图之类），地名浮在上面 */
  belowLabels?: LayerSpecification[];
  /** 画在最上层的图层（可点击的点、选中高亮） */
  overlays?: LayerSpecification[];
  /** 全局状态（maplibre 的 global-state），默认值必须与主题无关，换主题时样式才能按 diff 更新 */
  state?: StyleSpecification["state"];
}

export function createBasemap(o: BasemapOptions): StyleSpecification {
  const c = o.palette;
  const locale = o.locale ?? "en";
  const NAME: ExpressionSpecification = ["coalesce", ...NAME_FIELDS[locale].map((f): ExpressionSpecification => ["get", f]), ["get", "name"]];
  const roadClasses = (classes: string[]): ExpressionSpecification => [
    "all",
    ["match", ["get", "class"], classes, true, false],
    ["!=", ["get", "brunnel"], "tunnel"],
  ];
  const railClasses = roadClasses(["rail", "transit"]);
  const RAIL_NAME: ExpressionSpecification = ["coalesce", ...RAIL_NAME_FIELDS[locale].map((f): ExpressionSpecification => ["get", f]), ["get", "n"]];
  const line = (id: string, minzoom: number, filter: ExpressionSpecification, color: string, w: [number, number][]): LayerSpecification => ({
    id,
    type: "line",
    source: SOURCE,
    "source-layer": "transportation",
    minzoom,
    filter,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": color, "line-width": width(w) },
  });
  const landcover = (id: string, classes: string[], color: string): LayerSpecification => ({
    id,
    type: "fill",
    source: SOURCE,
    "source-layer": "landcover",
    filter: ["match", ["get", "class"], classes, true, false],
    paint: { "fill-color": color, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.6, 12, 1] },
  });

  const layers: LayerSpecification[] = [
    { id: "land", type: "background", paint: { "background-color": c.land } },

    // ---- 地表 ----
    // 每类一层、颜色用常量：按要素取值的颜色（match）换主题时要等 worker 重新处理瓦片，比别的图层晚一拍变色，看起来在闪
    landcover("landcover-wood", ["wood"], c.wood),
    landcover("landcover-grass", ["grass", "farmland", "wetland"], c.grass),
    landcover("landcover-sand", ["sand"], c.sand),
    {
      id: "urban",
      type: "fill",
      source: SOURCE,
      "source-layer": "landuse",
      minzoom: 9,
      filter: ["match", ["get", "class"], ["residential", "commercial", "industrial", "retail"], true, false],
      paint: { "fill-color": c.urban },
    },
    {
      id: "park",
      type: "fill",
      source: SOURCE,
      "source-layer": "park",
      minzoom: 9,
      paint: { "fill-color": c.park },
    },
    {
      id: "water",
      type: "fill",
      source: SOURCE,
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": c.water },
    },
    // 水深：近岸一段保持透明，避免低分辨率高程把海岸线附近的陆地染蓝；放大到城市级别后淡出
    {
      id: "bathymetry",
      type: "color-relief",
      source: DEM,
      maxzoom: 10,
      paint: {
        "color-relief-color": [
          "interpolate", ["linear"], ["elevation"],
          -8000, c.depthDeep,
          -3000, c.depthMid,
          -400, c.depthShelf,
          -60, "rgba(0, 0, 0, 0)",
        ],
        "color-relief-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 9.5, 0],
      },
    },
    {
      id: "hillshade",
      type: "hillshade",
      source: DEM,
      maxzoom: 14,
      paint: {
        "hillshade-shadow-color": c.hillshadeShadow,
        "hillshade-highlight-color": c.hillshadeHighlight,
        "hillshade-accent-color": "rgba(0, 0, 0, 0)",
        "hillshade-exaggeration": 0.35,
      },
    },
    {
      id: "waterway",
      type: "line",
      source: SOURCE,
      "source-layer": "waterway",
      minzoom: 8,
      filter: ["match", ["get", "class"], ["river", "canal"], true, false],
      paint: { "line-color": c.water, "line-width": width([[8, 0.6], [14, 3], [18, 10]]) },
    },
    {
      id: "building",
      type: "fill",
      source: SOURCE,
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-color": c.building,
        "fill-outline-color": c.buildingLine,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1],
      },
    },


    // ---- 道路：白色加淡描边，高速暖黄 ----
    line("road-minor-casing", 13, roadClasses(["minor", "service"]), c.roadCasing, [[13, 1.5], [16, 6], [19, 22]]),
    line("road-major-casing", 9, roadClasses(["primary", "secondary", "tertiary"]), c.majorCasing, [[9, 1.2], [13, 3.5], [16, 9], [19, 28]]),
    line("road-motorway-casing", 7, roadClasses(["motorway", "trunk"]), c.motorwayCasing, [[7, 1.4], [10, 2.6], [13, 4.5], [16, 11], [19, 32]]),
    line("road-minor", 13, roadClasses(["minor", "service"]), c.road, [[13, 0.6], [16, 4], [19, 18]]),
    line("road-major", 8, roadClasses(["primary", "secondary", "tertiary"]), c.major, [[8, 0.5], [10, 1], [13, 2.4], [16, 7], [19, 24]]),
    line("road-motorway", 5, roadClasses(["motorway", "trunk"]), c.motorway, [[5, 0.6], [7, 1], [10, 1.8], [13, 3.2], [16, 9], [19, 28]]),

    // ---- 铁路：底图的细灰线垫底，上面是按线路配色的线（高铁粗一些、地铁与路面电车细一些），车站带圆点 ----
    line("rail", 7, railClasses, c.rail, [[7, 0.4], [11, 0.9], [14, 1.6], [18, 3]]),
    {
      id: "rail-line-casing",
      type: "line",
      source: RAIL,
      "source-layer": "rail",
      minzoom: 9,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": c.land, "line-width": railWidth([0.6, 0.6, 1.2, 2]), "line-opacity": 0.9 },
    },
    {
      id: "rail-line",
      type: "line",
      source: RAIL,
      "source-layer": "rail",
      layout: { "line-cap": "round", "line-join": "round", "line-sort-key": ["match", ["get", "k"], "hs", 3, "train", 2, 1] },
      paint: {
        "line-color": ["coalesce", ["get", "c"], ["match", ["get", "k"], "hs", HS_COLOR, c.labelMuted]],
        "line-width": railWidth(),
        // 不压过地标：缩小时淡一些，地铁（多在地下）始终淡一些
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, ["match", ["get", "k"], "hs", 0.9, 0.7], 10, ["match", ["get", "k"], "subway", 0.7, 0.9]],
      },
    },

    // ---- 文字 ----
    {
      id: "water-name",
      type: "symbol",
      source: SOURCE,
      "source-layer": "water_name",
      filter: ["!", ["match", ["get", "class"], ["ocean", "sea"], true, false]],
      layout: {
        "text-field": NAME,
        "text-font": FONT_ITALIC,
        "text-size": 11,
        "text-letter-spacing": 0.15,
        "text-max-width": 6,
      },
      paint: { "text-color": c.waterLabel },
    },
    {
      id: "road-name",
      type: "symbol",
      source: SOURCE,
      "source-layer": "transportation_name",
      minzoom: 15,
      filter: ["match", ["get", "class"], ["primary", "secondary", "tertiary", "minor"], true, false],
      layout: { "text-field": NAME, "text-font": FONT, "text-size": 10, "symbol-placement": "line" },
      paint: { "text-color": c.labelMuted, "text-halo-color": c.land, "text-halo-width": 1.2 },
    },
    {
      id: "rail-name",
      type: "symbol",
      source: RAIL,
      "source-layer": "rail",
      minzoom: 11,
      filter: ["any", ["match", ["get", "k"], ["hs", "train"], true, false], [">=", ["zoom"], 13]],
      layout: {
        "text-field": RAIL_NAME,
        "text-font": FONT_BOLD,
        "text-size": 10,
        "symbol-placement": "line",
        "symbol-spacing": 420,
        "text-letter-spacing": 0.05,
      },
      paint: {
        "text-color": ["coalesce", ["get", "c"], ["match", ["get", "k"], "hs", HS_COLOR, c.labelMuted]],
        "text-halo-color": c.land,
        "text-halo-width": 1.6,
      },
    },
    {
      id: "station-dot",
      type: "circle",
      source: SOURCE,
      "source-layer": "poi",
      minzoom: 12,
      filter: ["all", ["==", ["get", "class"], "railway"], ["match", ["get", "subclass"], ["station", "halt"], true, false]],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 16, 5],
        "circle-color": c.road,
        "circle-stroke-color": c.labelMuted,
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 12, 1.2, 16, 2],
      },
    },
    {
      id: "station-name",
      type: "symbol",
      source: SOURCE,
      "source-layer": "poi",
      minzoom: 13,
      filter: ["all", ["==", ["get", "class"], "railway"], ["match", ["get", "subclass"], ["station", "halt"], true, false]],
      layout: {
        "text-field": NAME,
        "text-font": FONT_BOLD,
        "text-size": 11,
        "text-offset": [0, 0.9],
        "text-anchor": "top",
        "text-optional": true,
      },
      paint: { "text-color": c.label, "text-halo-color": c.land, "text-halo-width": 1.4 },
    },
    {
      id: "place-minor",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      minzoom: 11,
      filter: ["match", ["get", "class"], ["village", "suburb", "quarter"], true, false],
      layout: { "text-field": NAME, "text-font": FONT, "text-size": 11, "text-max-width": 6 },
      paint: { "text-color": c.labelMuted, "text-halo-color": c.land, "text-halo-width": 1.2 },
    },
    {
      id: "place-town",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      minzoom: 8,
      filter: ["==", ["get", "class"], "town"],
      layout: { "text-field": NAME, "text-font": FONT, "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 14, 14] },
      paint: { "text-color": c.label, "text-halo-color": c.land, "text-halo-width": 1.2 },
    },
    {
      id: "place-city",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      minzoom: 4,
      maxzoom: 15,
      filter: ["==", ["get", "class"], "city"],
      layout: {
        "text-field": NAME,
        "text-font": FONT_BOLD,
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, ["case", ["<=", ["get", "rank"], 2], 13, 11], 10, 18],
        "text-letter-spacing": 0.08,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": c.label, "text-halo-color": c.land, "text-halo-width": 1.4 },
    },
  ];

  const used = layers.filter((l) => {
    const source = "source" in l ? l.source : undefined;
    return (source !== RAIL || o.rail) && (source !== DEM || o.terrain !== false);
  });
  const sources: Record<string, SourceSpecification> = {
    [SOURCE]: { type: "vector", url: o.tiles ?? "https://tiles.openfreemap.org/planet" },
  };
  if (o.rail) sources[RAIL] = { type: "vector", url: o.rail, attribution: "© OpenStreetMap contributors" };
  if (o.terrain !== false) {
    sources[DEM] = {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      // 地形只用来画淡淡的山影和海深：按 512px 铺，同一视野只需要四分之一的瓦片（这个源没有 CDN，每块 60–90 KB）
      tileSize: 512,
      maxzoom: 10,
    };
  }

  return {
    version: 8,
    // 切换外观、语言时新样式一次到位，不做颜色渐变
    transition: { duration: 0, delay: 0 },
    projection: { type: o.globe === false ? "mercator" : "globe" },
    // 缩到最小是地球：球外是「太空」底色，边缘一圈大气光
    sky: {
      "sky-color": c.space,
      "horizon-color": c.horizon,
      "sky-horizon-blend": 0.6,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
    },
    glyphs: o.glyphs ?? "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    state: o.state,
    sources: { ...sources, ...o.sources },
    layers: [
      ...used.filter((l) => l.type !== "symbol"),
      ...(o.belowLabels ?? []),
      ...used.filter((l) => l.type === "symbol"),
      ...(o.overlays ?? []),
    ],
  };
}
