<script setup lang="ts">
// 地图本体：挂载时用 @mapette/core 的 createMap 创建，卸载时销毁，props 变化同步给控制器。
// 里面的控件、标记通过 useMap() 拿到控制器。
import { applyTheme, createMap, type Interaction, type Locale, type MapController, type Preset, type StyleInput, type Theme } from "@mapette/core";
import type { MapOptions, PaddingOptions } from "maplibre-gl";
import { onMounted, onUnmounted, provide, ref, shallowRef, watch } from "vue";
import { ScaleBar } from "./components";
import { MAP_CONTEXT } from "./context";

const props = withDefaults(defineProps<{
  /** static：只展示；compact：卡片里的小地图（默认）；explore：全屏探索 */
  preset?: Preset;
  /** 样式 URL、样式对象，或按配色生成；不给就是 mapette 的底图。函数本身变化（如换语言）会重新生成 */
  mapStyle?: StyleInput;
  locale?: Locale;
  center?: [number, number];
  zoom?: number;
  interactive?: boolean | Interaction;
  hash?: string | false;
  attribution?: boolean;
  /** 是否深色；不给就看 <html> 的 data-theme / class="dark"，都没有就跟随系统 */
  dark?: boolean;
  keepSources?: string[];
  /** 被浮层面板挡住的边距 */
  padding?: PaddingOptions;
  /** 这张地图（及里面的控件）的配色，覆盖默认主题的任意几项；全局换色用 applyTheme(document.documentElement, …) */
  theme?: Theme;
  /** 显示比例尺（也可以在里面放 <ScaleBar /> 自己控制） */
  scale?: boolean;
  /** 其余 maplibre 选项（只在创建时生效） */
  options?: Partial<MapOptions>;
}>(), {
  preset: "compact",
  mapStyle: undefined,
  locale: undefined,
  center: undefined,
  zoom: undefined,
  interactive: undefined,
  hash: undefined,
  attribution: undefined,
  dark: undefined,
  keepSources: () => [],
  padding: undefined,
  theme: undefined,
  scale: false,
  options: undefined,
});

const emit = defineEmits<{ load: [controller: MapController] }>();

const root = ref<HTMLDivElement>();
const el = ref<HTMLDivElement>();
let undoTheme: (() => void) | null = null;
const setTheme = (t: Theme | undefined) => {
  undoTheme?.();
  undoTheme = t ? applyTheme(root.value!, t) : null;
};
const controller = shallowRef<MapController | null>(null);
provide(MAP_CONTEXT, { controller });
defineExpose({ controller });

let unmounted = false;
onMounted(async () => {
  setTheme(props.theme); // 先上色，createMap 读配色时就是这套
  const initial = { dark: props.dark, mapStyle: props.mapStyle, locale: props.locale };
  const ctrl = await createMap({
    container: el.value!,
    preset: props.preset,
    style: props.mapStyle,
    locale: props.locale,
    center: props.center,
    zoom: props.zoom,
    interactive: props.interactive,
    hash: props.hash,
    attribution: props.attribution,
    dark: props.dark,
    keepSources: props.keepSources,
    padding: props.padding,
    maplibre: props.options,
  });
  // 地图（异步）创建完成前组件已经卸载
  if (unmounted) return ctrl.destroy();
  // 创建期间 props 可能已经变了（例如旁边的面板挂载后才报出留白），补一次
  if (props.padding) ctrl.setPadding(props.padding);
  if (props.dark !== initial.dark) ctrl.setDark(props.dark);
  if (props.mapStyle !== initial.mapStyle) ctrl.setStyle(props.mapStyle);
  if (props.locale && props.locale !== initial.locale) ctrl.setLocale(props.locale);
  controller.value = ctrl;
  emit("load", ctrl);
});
// 等里面的控件、标记都卸载完（它们在 beforeUnmount 里移除）再销毁地图
onUnmounted(() => {
  unmounted = true;
  controller.value?.destroy();
});

watch(() => props.dark, (d) => controller.value?.setDark(d));
watch(() => props.theme, (t) => {
  setTheme(t);
  controller.value?.refresh();
}, { deep: true });
watch(() => props.mapStyle, (s) => controller.value?.setStyle(s));
watch(() => props.locale, (l) => l && controller.value?.setLocale(l));
watch(() => props.padding, (p) => p && controller.value?.setPadding(p));
// 位置变了（例如换了一张照片）直接跳过去，不做动画；用 center 的数值比较，父组件每次传新数组也不会误触发
// getter 返回字符串：返回数组的话每次都是新对象，父组件一重新渲染就会误判为「变了」，把地图拉回初始视野
watch(() => `${props.center?.[0]},${props.center?.[1]},${props.zoom}`, () => {
  const m = controller.value?.map;
  const [lng, lat] = props.center ?? [];
  if (m && lng !== undefined && lat !== undefined) m.jumpTo({ center: [lng, lat], ...(props.zoom !== undefined ? { zoom: props.zoom } : {}) });
});
</script>

<template>
  <div ref="root" class="mapette-map-view">
    <div ref="el" />
    <ScaleBar v-if="scale" />
    <slot />
  </div>
</template>
