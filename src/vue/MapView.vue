<script setup lang="ts">
// 地图本体：创建 maplibre 实例、跟随亮暗与语言换样式、避开浮层面板，并把实例提供给内部的控件。
import maplibregl, { type MapOptions, type PaddingOptions, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { computed, onMounted, onUnmounted, provide, ref, shallowRef, watch } from "vue";
import { CJK_FONT_FAMILY } from "../style/basemap";
import { readPalette, type Palette } from "../style/palette";
import { MAP_CONTEXT } from "./context";
import { useDarkMode } from "./useDarkMode";

const props = withDefaults(defineProps<{
  /** 按配色生成样式（通常是 createBasemap 加上自己的数据源与图层）；函数本身变化（如换语言）会重新生成 */
  mapStyle: (palette: Palette) => StyleSpecification;
  /** 是否深色；不给就看 <html> 的 data-theme / class="dark"，都没有就跟随系统 */
  dark?: boolean;
  /**
   * 换样式时原样保留的数据源。maplibre 按 diff 更新样式，但 geojson 源序列化后与新样式的写法不同，
   * 会被当成新源重新加载、重新解析——几万个点的源要列在这里
   */
  keepSources?: string[];
  /** 被浮层面板挡住的边距，地图的可视中心会避开它（至少给地图留出 200px 见方） */
  padding?: PaddingOptions;
  center?: [number, number];
  zoom?: number;
  /** 视野写进 URL 的 #<hash>=缩放/纬度/经度；false 不写 */
  hash?: string | false;
  /** 其余 maplibre 选项 */
  options?: Partial<MapOptions>;
}>(), {
  dark: undefined,
  keepSources: () => [],
  padding: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  center: () => [10, 30],
  zoom: 2,
  hash: "map",
});

const emit = defineEmits<{
  /** 地图创建完成（样式可能还在加载） */
  load: [map: maplibregl.Map];
}>();

const el = ref<HTMLDivElement>();
const map = shallowRef<maplibregl.Map | null>(null);
const ready = ref(false);
const systemDark = useDarkMode();
const dark = computed(() => props.dark ?? systemDark.value);

/** 面板挡住的留白，但至少给地图留出 200px 见方：手机上抽屉拉满时留白几乎等于整个画布，fitBounds 会放不下而报错 */
const usablePadding = computed<PaddingOptions>(() => {
  const p = props.padding;
  const c = el.value;
  if (!c) return p;
  const room = (size: number, a: number, b: number) => Math.max(0, Math.min(a, size - 200 - b));
  return { ...p, bottom: room(c.clientHeight, p.bottom ?? 0, p.top ?? 0), left: room(c.clientWidth, p.left ?? 0, p.right ?? 0) };
});

provide(MAP_CONTEXT, { map, ready, padding: usablePadding });
defineExpose({ map });

const build = () => props.mapStyle(readPalette(el.value!));

// 换主题或语言只换颜色和地名字段：样式按 diff 更新，keepSources 里的源沿用当前的定义
function restyle() {
  map.value?.setStyle(build(), {
    transformStyle: (prev, next) => ({
      ...next,
      sources: { ...next.sources, ...Object.fromEntries(props.keepSources.filter((id) => prev?.sources[id]).map((id) => [id, prev!.sources[id]])) },
    }),
  });
}

// 按线路配色的铁路这类图层是单个 PMTiles 文件，按 HTTP Range 读取；只有样式里用到时才加载 pmtiles
let pmtilesAdded = false;
async function ensurePmtiles(style: StyleSpecification) {
  if (pmtilesAdded || !JSON.stringify(style.sources).includes("pmtiles://")) return;
  const { Protocol } = await import("pmtiles");
  if (!pmtilesAdded) maplibregl.addProtocol("pmtiles", new Protocol().tile);
  pmtilesAdded = true;
}

onMounted(async () => {
  const style = build();
  await ensurePmtiles(style);
  const m = (map.value = new maplibregl.Map({
    container: el.value!,
    style,
    center: props.center,
    zoom: props.zoom,
    hash: props.hash || false,
    localIdeographFontFamily: CJK_FONT_FAMILY,
    attributionControl: false, // 署名由使用方放在面板里
    // 默认只在内存里留 5 个缩放级别的瓦片，来回缩放会重新加载；淡入时间也缩短，加载完更快显现
    maxTileCacheZoomLevels: 10,
    fadeDuration: 150,
    ...props.options,
  }));
  m.setPadding(usablePadding.value);
  m.on("style.load", () => (ready.value = true));
  emit("load", m);
});

// 父组件的 beforeUnmount 先于子组件执行：等里面的控件、标记都卸载完（unmounted）再销毁地图
onUnmounted(() => map.value?.remove());

watch([dark, () => props.mapStyle], restyle, { flush: "post" });
// setPadding 会打断进行中的动画，所以相机在动时等它停下再设
watch(usablePadding, (p) => {
  const m = map.value;
  if (!m) return;
  if (m.isMoving()) m.once("moveend", () => m.setPadding(usablePadding.value));
  else m.setPadding(p);
});
</script>

<template>
  <div class="meisho-map-view">
    <div ref="el" class="meisho-map" />
    <slot />
  </div>
</template>

<style>
.meisho-map-view {
  position: absolute;
  inset: 0;
}
/* 容器同时带着 maplibre 的 .maplibregl-map { position: relative }，两边特异性相同时谁后加载谁赢，这里多一层选择器保证盖过它 */
.meisho-map-view > .meisho-map {
  position: absolute;
  inset: 0;
  /* 缩到最小时地球之外露出的是容器背景 */
  background: radial-gradient(circle at 60% 50%, var(--meisho-map-horizon), var(--meisho-map-space) 70%);
}
.meisho-map .maplibregl-ctrl-geolocate {
  display: none;
}
</style>
