<script setup lang="ts">
// 全屏探索的整个骨架（圣地巡礼地图、摄影机位地图共用）：
// 地图（explore 预设）+ 比例尺与按钮 + 桌面侧栏 / 手机抽屉 + 面板挡住的留白 + 通用键盘操作。
// 站点只需要给出样式、往地图里放自己的图层组件（#map），往面板里放内容（#header / 默认 / #footer）。
import { onShortcuts, type KeyHandler, type Locale, type MapController, type SheetSnap, type StyleInput, type Theme } from "@mapette/core";
import type { PaddingOptions } from "maplibre-gl";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { MapControls, ScaleBar } from "./components";
import MapSheet from "./MapSheet.vue";
import MapView from "./MapView.vue";

const props = withDefaults(defineProps<{
  mapStyle?: StyleInput;
  locale?: Locale;
  keepSources?: string[];
  theme?: Theme;
  dark?: boolean;
  center?: [number, number];
  zoom?: number;
  /** 视野写进 URL 的 #<hash>=…；false 不写 */
  hash?: string | false;
  /** 署名默认关闭：骨架的面板底部（#footer）是放署名的地方 */
  attribution?: boolean;
  labels?: { locate?: string; zoomIn?: string; zoomOut?: string };
  /** 站点自己的快捷键（按键名 → 处理函数），与内置的合并，同名时站点的优先 */
  shortcuts?: Record<string, KeyHandler>;
  /** 关掉内置快捷键（+ − 缩放、L 定位、N 指北、Esc 返回） */
  keyboard?: boolean;
  /** 选中点的弹出卡片，默认关闭（详情已经在面板里）；点气泡弹出的菜单不受影响 */
  popovers?: boolean;
}>(), {
  mapStyle: undefined,
  locale: undefined,
  keepSources: () => [],
  theme: undefined,
  dark: undefined,
  center: undefined,
  zoom: undefined,
  hash: "map",
  attribution: false,
  labels: undefined,
  shortcuts: () => ({}),
  keyboard: true,
  popovers: false,
});

const emit = defineEmits<{
  load: [controller: MapController];
  /** Esc：站点决定「返回」是什么（关掉详情、清空选择……）。要自己决定是否拦截，就在 shortcuts 里给 Escape */
  escape: [e: KeyboardEvent];
  /** 面板挡住的边距（例如让浮在地图上的提示避开抽屉） */
  padding: [padding: PaddingOptions];
}>();

const snap = defineModel<SheetSnap>("snap", { default: "half" });
const padding = ref<PaddingOptions>({ top: 0, right: 0, bottom: 0, left: 0 });
const controller = shallowRef<MapController | null>(null);
const controls = ref<InstanceType<typeof MapControls>>();
const sheet = ref<InstanceType<typeof MapSheet>>();
/** 面板元素（站点有时要直接操作它，例如手机上点搜索框时不带动画地撑开抽屉） */
const panel = computed(() => sheet.value?.el ?? null);
/** 面板是底部抽屉的宽度（与 mapette.css 的断点一致）；桌面侧栏不随拖动收起 */
const phone = typeof matchMedia === "function" ? matchMedia("(max-width: 640px)") : { matches: false };
function onPadding(p: PaddingOptions) {
  padding.value = p;
  emit("padding", p);
}

function onLoad(ctrl: MapController) {
  controller.value = ctrl;
  // 手机上碰到地图：全屏的抽屉让开，回到半屏；拖动地图时收到最小，把地图让出来。
  // dragstart 只在用手拖动时触发，选中点之后的自动平移（reveal、easeTo）和键盘平移都不会收起面板
  ctrl.map.getCanvasContainer().addEventListener("pointerdown", () => {
    if (snap.value === "full") snap.value = "half";
  });
  ctrl.map.on("dragstart", () => {
    if (phone.matches) snap.value = "peek";
  });
  emit("load", ctrl);
}

let off: (() => void) | null = null;
onMounted(() => {
  // 内置的通用操作；站点的同名快捷键覆盖它们
  const builtin: Record<string, KeyHandler> = {
    "+": () => void controller.value?.map.zoomIn(),
    "=": () => void controller.value?.map.zoomIn(),
    "-": () => void controller.value?.map.zoomOut(),
    l: () => (controls.value as unknown as { locate(): void } | undefined)?.locate(),
    n: () => (controls.value as unknown as { resetNorth(): void } | undefined)?.resetNorth(),
    Escape: (e) => emit("escape", e),
  };
  off = onShortcuts(() => ({ ...(props.keyboard ? builtin : {}), ...props.shortcuts }));
});
onBeforeUnmount(() => off?.());

defineExpose({ controller, snap, panel });
</script>

<template>
  <div class="mapette-explorer">
    <MapView
      preset="explore"
      :map-style="mapStyle"
      :locale="locale"
      :keep-sources="keepSources"
      :theme="theme"
      :dark="dark"
      :center="center"
      :zoom="zoom"
      :hash="hash"
      :attribution="attribution"
      :padding="padding"
      :popovers="popovers"
      @load="onLoad"
    >
      <ScaleBar />
      <MapControls ref="controls" :labels="labels" />
      <slot name="map" />
    </MapView>
    <MapSheet ref="sheet" v-model:snap="snap" @update:padding="onPadding">
      <template v-if="$slots.header" #header><slot name="header" /></template>
      <slot />
      <template v-if="$slots.footer" #footer><slot name="footer" /></template>
    </MapSheet>
  </div>
</template>
