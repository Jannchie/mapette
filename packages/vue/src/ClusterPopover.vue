<script setup lang="ts">
// 点击聚合气泡：不放大，在气泡上弹出菜单（没有箭头，可以盖住气泡，优先完整显示），列出里面的点。
// 内容由调用者用作用域插槽决定（#default="{ features, count, close, zoomIn }"）；不写插槽时用默认渲染：
// 「N 个地点」加一个名称列表（名称取 label），点一项触发 pick。地图不会因为点了气泡而缩放。
import { clusterLeaves, kitText } from "@mapette/core";
import type { Feature, Point } from "geojson";
import type { MapLayerMouseEvent } from "maplibre-gl";
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { useMap } from "./context";
import MapPopover from "./MapPopover.vue";

const props = withDefaults(defineProps<{
  /** 聚合数据源 */
  source: string;
  /** 气泡图层（clusterLayers 生成的 id 与 id-count） */
  layers?: string[];
  /** 最多取出多少个点；默认全部（在浏览器的聚合索引里取，不走网络，几千个也很快） */
  limit?: number;
  /** 默认渲染里每一项的名称 */
  label?: (f: Feature) => string;
  labels?: { count?: (n: number) => string; zoomIn?: string; close?: string; more?: (n: number) => string };
}>(), {
  layers: () => ["cluster", "cluster-count"],
  limit: undefined,
  label: (f: Feature) => String(f.properties?.name ?? f.properties?.title ?? f.id ?? ""),
  labels: () => ({}),
});

const emit = defineEmits<{ pick: [feature: Feature] }>();

const { controller, locale } = useMap();
// 自带的文字按地图的语言；labels 里给了的项覆盖它
const text = computed(() => {
  const k = kitText(locale.value);
  return { count: k.places, zoomIn: k.zoomInHere, close: k.close, more: k.more, ...props.labels };
});
const at = ref<[number, number] | null>(null);
const cluster = shallowRef<{ id: number; count: number; features: Feature[] } | null>(null);
let seq = 0;

async function onClick(e: MapLayerMouseEvent) {
  const f = e.features?.[0];
  const id = f?.properties?.cluster_id;
  if (!f || id == null || !controller.value) return;
  const n = ++seq;
  const lngLat = (f.geometry as Point).coordinates as [number, number];
  const features = await clusterLeaves(controller.value.map, props.source, id, props.limit ?? Number(f.properties.point_count));
  if (n !== seq) return;
  cluster.value = { id, count: Number(f.properties.point_count), features };
  at.value = lngLat;
  zoomAtOpen = controller.value.map.getZoom();
}
function close() {
  seq++;
  at.value = null;
  cluster.value = null;
}
/** 用户主动要求时才放大：到这个气泡拆开的那一级 */
async function zoomIn() {
  const m = controller.value?.map;
  const c = cluster.value;
  if (!m || !c || !at.value) return;
  const src = m.getSource(props.source) as { getClusterExpansionZoom(id: number): Promise<number> } | undefined;
  const zoom = Math.max((await src?.getClusterExpansionZoom(c.id)) ?? m.getZoom() + 2, m.getZoom() + 1);
  m.easeTo({ center: at.value, zoom });
  close();
}
function pick(f: Feature) {
  emit("pick", f);
  close();
}

// 缩放真的变了（气泡可能已经重新合并或拆开，菜单指向的那个不存在了）才关闭。
// 只是平移不关：球面投影下平移也会让缩放有细微变化、触发 zoomend，所以和打开菜单时的缩放比较变化量
// （滚轮缩放是一连串小手势，逐次比较每次都不到阈值）
let zoomAtOpen = 0;
const onZoomEnd = () => {
  const z = controller.value?.map.getZoom() ?? 0;
  if (at.value && Math.abs(z - zoomAtOpen) >= 0.5) close();
};

const enter = () => controller.value && (controller.value.map.getCanvas().style.cursor = "pointer");
const leave = () => controller.value && (controller.value.map.getCanvas().style.cursor = "");
watch(controller, (ctrl, prev) => {
  for (const l of props.layers) {
    prev?.map.off("click", l, onClick);
    prev?.map.off("mouseenter", l, enter);
    prev?.map.off("mouseleave", l, leave);
    ctrl?.map.on("click", l, onClick);
    ctrl?.map.on("mouseenter", l, enter);
    ctrl?.map.on("mouseleave", l, leave);
  }
  prev?.map.off("zoomend", onZoomEnd);
  ctrl?.map.on("zoomend", onZoomEnd);
}, { immediate: true });
onBeforeUnmount(() => {
  const m = controller.value?.map;
  for (const l of props.layers) {
    m?.off("click", l, onClick);
    m?.off("mouseenter", l, enter);
    m?.off("mouseleave", l, leave);
  }
  m?.off("zoomend", onZoomEnd);
});

defineExpose({ close });
</script>

<template>
  <MapPopover :lng-lat="at" menu :close-label="text.close" @close="close">
    <template v-if="cluster">
      <slot :features="cluster.features" :count="cluster.count" :close="close" :zoom-in="zoomIn">
        <div class="mapette-cluster-pop">
          <div class="mapette-cluster-pop-head">{{ text.count(cluster.count) }}</div>
          <ul>
            <li v-for="(f, i) in cluster.features" :key="String(f.id ?? i)">
              <button type="button" @click="pick(f)">{{ label(f) }}</button>
            </li>
          </ul>
          <div v-if="cluster.count > cluster.features.length" class="mapette-cluster-pop-foot">{{ text.more(cluster.count - cluster.features.length) }}</div>
        </div>
      </slot>
    </template>
  </MapPopover>
</template>
