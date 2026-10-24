// 地图控制器：创建 maplibre 实例、按预设设置交互、跟随亮暗与语言换样式、避开浮层面板。
// 框架无关；各框架的绑定只负责在挂载时 createMap、卸载时 destroy、把 props 同步过来。
import type { Map as MaplibreMap, MapOptions, PaddingOptions, StyleSpecification } from "maplibre-gl";
import { CJK_FONT_FAMILY, createBasemap, type Locale } from "./style/basemap";
import { readPalette, type Palette } from "./style/palette";
import { isDarkMode, watchDarkMode } from "./theme";

export type Maplibre = typeof import("maplibre-gl");

/**
 * - static：只用来展示，不能拖动、缩放；平面投影；不画山影水深，最轻
 * - compact：卡片、侧栏里的小地图，可平移缩放，不能旋转倾斜；平面投影
 * - explore：全屏探索，全部交互；球面投影；视野写进 URL
 */
export type Preset = "static" | "compact" | "explore";

export interface Interaction {
  pan?: boolean;
  zoom?: boolean;
  rotate?: boolean;
}

export interface StyleContext {
  palette: Palette;
  dark: boolean;
  locale: Locale;
  preset: Preset;
}

/**
 * 样式：样式 URL、样式对象，或按当前配色生成（默认是 mapette 的底图）。
 * 要按亮暗换别家的底图，就给函数：({ dark }) => dark ? DARK_URL : LIGHT_URL
 */
export type StyleInput = string | StyleSpecification | ((ctx: StyleContext) => string | StyleSpecification);

export interface MapetteOptions {
  container: HTMLElement;
  preset?: Preset;
  style?: StyleInput;
  /** 地名的显示语言（只对 mapette 的底图有效） */
  locale?: Locale;
  center?: [number, number];
  zoom?: number;
  /** 覆盖预设的交互：false 全部关闭，或按项开关 */
  interactive?: boolean | Interaction;
  /** 视野写进 URL 的 #<hash>=缩放/纬度/经度；默认只有 explore 写 */
  hash?: string | false;
  /** 署名：默认是紧凑的 ⓘ 按钮；自己在别处写了署名才关掉 */
  attribution?: boolean;
  /** 是否深色；不给就看 <html> 的 data-theme / class="dark"，都没有就跟随系统 */
  dark?: boolean;
  /**
   * 换样式时原样保留的数据源。maplibre 按 diff 更新样式，但 geojson 源序列化后与新样式的写法不同，
   * 会被当成新源重新加载、重新解析——几万个点的源要列在这里
   */
  keepSources?: string[];
  /** 被浮层面板挡住的边距，地图的可视中心会避开它 */
  padding?: PaddingOptions;
  /**
   * 选中点的弹出卡片（MapPopover 的卡片形态）。默认关闭：详情通常已经在面板里，卡片会重复、挡住地图。
   * 菜单形态（点气泡弹出的列表）不受影响
   */
  popovers?: boolean;
  /** 其余 maplibre 选项（最后合并，优先级最高） */
  maplibre?: Partial<MapOptions>;
}

export interface MapController {
  map: MaplibreMap;
  /** maplibre-gl 模块（按需加载的那一份），用来创建 Marker 等 */
  lib: Maplibre;
  readonly preset: Preset;
  /** 是否显示选中点的弹出卡片（见 MapetteOptions.popovers） */
  readonly popovers: boolean;
  setPopovers(enabled: boolean): void;
  /** undefined 表示跟随页面 */
  setDark(dark: boolean | undefined): void;
  setStyle(style: StyleInput | undefined): void;
  setLocale(locale: Locale): void;
  setPadding(padding: PaddingOptions): void;
  /** 重新读配色、重新生成样式（例如改了主题颜色之后） */
  refresh(): void;
  /**
   * 让一个位置出现在可见区域（避开面板）里：已经看得到就不动，看不到就平移过去。从不改变缩放——
   * 选中一个点之后自动放大，对用户是负担（看不清周围、还得自己缩回去）
   */
  reveal(lngLat: [number, number], margin?: number): void;
  /** 实际生效的留白：至少给地图留出 200px 见方 */
  getPadding(): PaddingOptions;
  /** 每次样式加载完成（含换主题）时回调；返回取消函数 */
  onStyleLoad(callback: () => void): () => void;
  destroy(): void;
}

const ZERO: PaddingOptions = { top: 0, right: 0, bottom: 0, left: 0 };

const PRESETS: Record<Preset, { interaction: Required<Interaction>; globe: boolean; terrain: boolean; hash: string | false }> = {
  static: { interaction: { pan: false, zoom: false, rotate: false }, globe: false, terrain: false, hash: false },
  compact: { interaction: { pan: true, zoom: true, rotate: false }, globe: false, terrain: true, hash: false },
  explore: { interaction: { pan: true, zoom: true, rotate: true }, globe: true, terrain: true, hash: "map" },
};

function interactionOptions(i: Required<Interaction>): Partial<MapOptions> {
  return {
    interactive: i.pan || i.zoom || i.rotate,
    dragPan: i.pan,
    keyboard: i.pan,
    scrollZoom: i.zoom,
    boxZoom: i.zoom,
    doubleClickZoom: i.zoom,
    touchZoomRotate: i.zoom,
    dragRotate: i.rotate,
    pitchWithRotate: i.rotate,
    touchPitch: i.rotate,
  };
}

export async function createMap(o: MapetteOptions): Promise<MapController> {
  // maplibre 约 1 MB，挂载时才加载；服务端渲染时不会碰到它
  const [mod] = await Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]);
  // maplibre-gl 是 UMD 包：经打包工具转换后，模块本身在 default 上
  const lib = ((mod as { default?: Maplibre }).default ?? mod) as Maplibre;
  const preset = o.preset ?? "compact";
  const p = PRESETS[preset];
  const interaction = o.interactive === undefined ? p.interaction
    : typeof o.interactive === "boolean" ? { pan: o.interactive, zoom: o.interactive, rotate: o.interactive && p.interaction.rotate }
    : { ...p.interaction, ...o.interactive };

  let style: StyleInput | undefined = o.style;
  let locale: Locale = o.locale ?? "en";
  let dark = o.dark;
  let padding = o.padding ?? ZERO;
  let pageDark = false;
  const isDark = () => dark ?? pageDark;

  const build = (): string | StyleSpecification => {
    const ctx: StyleContext = { palette: readPalette(o.container), dark: isDark(), locale, preset };
    if (style === undefined) return createBasemap({ palette: ctx.palette, locale, globe: p.globe, terrain: p.terrain });
    return typeof style === "function" ? style(ctx) : style;
  };

  // 按线路配色的铁路这类图层是单个 PMTiles 文件，按 HTTP Range 读取；只有样式里用到时才加载 pmtiles
  const ensurePmtiles = async (s: string | StyleSpecification) => {
    if (typeof s === "string" || !JSON.stringify(s.sources).includes("pmtiles://")) return;
    if ((lib as unknown as { __mapettePmtiles?: boolean }).__mapettePmtiles) return;
    const { Protocol } = await import("pmtiles");
    lib.addProtocol("pmtiles", new Protocol().tile);
    (lib as unknown as { __mapettePmtiles?: boolean }).__mapettePmtiles = true;
  };

  const usable = (): PaddingOptions => {
    const c = o.container;
    const room = (size: number, a = 0, b = 0) => Math.max(0, Math.min(a, size - 200 - b));
    return { ...padding, bottom: room(c.clientHeight, padding.bottom, padding.top), left: room(c.clientWidth, padding.left, padding.right) };
  };
  // 控件按留白避开面板（CSS 里用 --mapette-pad-left / --mapette-pad-bottom）
  const exposePadding = (q: PaddingOptions) => {
    o.container.style.setProperty("--mapette-pad-left", `${q.left ?? 0}px`);
    o.container.style.setProperty("--mapette-pad-bottom", `${q.bottom ?? 0}px`);
  };

  // 明确指定亮暗时，配色按容器上的 color-scheme 求值，不受页面主题影响
  const applyScheme = () => {
    o.container.style.colorScheme = dark === undefined ? "" : dark ? "dark" : "light";
  };
  pageDark = isDarkMode();
  applyScheme();
  // 先挂上类名：铺满容器的样式要在 maplibre 量尺寸之前生效
  o.container.classList.add("mapette-map", `mapette-${preset}`);
  const initial = build();
  await ensurePmtiles(initial);
  const map = new lib.Map({
    container: o.container,
    style: initial,
    center: o.center ?? [10, 30],
    zoom: o.zoom ?? 2,
    hash: o.hash ?? p.hash,
    localIdeographFontFamily: CJK_FONT_FAMILY,
    attributionControl: o.attribution === false ? false : { compact: true },
    // 默认只在内存里留 5 个缩放级别的瓦片，来回缩放会重新加载；淡入时间也缩短，加载完更快显现
    maxTileCacheZoomLevels: 10,
    fadeDuration: 150,
    ...interactionOptions(interaction),
    ...o.maplibre,
  });
  if (!interaction.rotate) map.touchZoomRotate.disableRotation();
  map.setPadding(usable());
  exposePadding(usable());

  // 换留白时画面不动：maplibre 默认让同一个中心点移到新的可见区域中央，面板一收一展地图就跟着跳。
  // 改成以新可见区域中央此刻对着的位置为中心，面板只是盖住或露出地图
  const keepView = (q: PaddingOptions) => {
    const c = o.container;
    const x = q.left! + (c.clientWidth - q.left! - q.right!) / 2;
    const y = q.top! + (c.clientHeight - q.top! - q.bottom!) / 2;
    map.jumpTo({ center: map.unproject([x, y]), padding: q });
  };

  // 紧凑署名在加载时会自动展开，盖住半张小地图；收回成 ⓘ，全文点一下就能看到
  // 数据源的署名到得比 load 晚（别家底图常见），等第一次 idle 再收一次
  const collapseAttribution = () => {
    const attrib = o.container.querySelector("details.maplibregl-ctrl-attrib");
    attrib?.classList.remove("maplibregl-compact-show");
    attrib?.removeAttribute("open");
  };
  map.once("load", collapseAttribution);
  map.once("idle", collapseAttribution);

  // 换主题或语言只换颜色和地名字段：样式按 diff 更新，keepSources 里的源沿用当前的定义
  const restyle = async () => {
    const next = build();
    await ensurePmtiles(next);
    const keep = o.keepSources ?? [];
    map.setStyle(next, typeof next === "string" ? undefined : {
      transformStyle: (prev, s) => ({
        ...s,
        sources: { ...s.sources, ...Object.fromEntries(keep.filter((id) => prev?.sources[id]).map((id) => [id, prev!.sources[id]])) },
      }),
    });
  };

  const stopWatching = watchDarkMode((d) => {
    const changed = d !== pageDark;
    pageDark = d;
    if (changed && dark === undefined) void restyle();
  });

  let popovers = o.popovers ?? false;
  return {
    map,
    lib,
    preset,
    get popovers() {
      return popovers;
    },
    setPopovers(enabled) {
      popovers = enabled;
      map.fire("mapette:popovers"); // 已经打开的卡片据此显示或隐藏
    },
    setDark(next) {
      const before = isDark();
      dark = next;
      applyScheme();
      if (isDark() !== before) void restyle();
    },
    setStyle(next) {
      style = next;
      void restyle();
    },
    setLocale(next) {
      if (next === locale) return;
      locale = next;
      void restyle();
    },
    setPadding(next) {
      padding = next;
      const q = usable();
      exposePadding(q);
      // setPadding 会打断进行中的动画，所以相机在动时等它停下再设
      if (map.isMoving()) map.once("moveend", () => keepView(usable()));
      else keepView(q);
    },
    refresh() {
      void restyle();
    },
    reveal(lngLat, margin = 48) {
      const { x, y } = map.project(lngLat);
      const q = usable();
      const c = o.container;
      const inside = x >= (q.left ?? 0) + margin && x <= c.clientWidth - (q.right ?? 0) - margin
        && y >= (q.top ?? 0) + margin && y <= c.clientHeight - (q.bottom ?? 0) - margin;
      if (!inside) map.easeTo({ center: lngLat, duration: 600 });
    },
    getPadding: usable,
    onStyleLoad(callback) {
      map.on("style.load", callback);
      if (map.isStyleLoaded()) callback();
      return () => map.off("style.load", callback);
    },
    destroy() {
      stopWatching();
      map.remove();
    },
  };
}
