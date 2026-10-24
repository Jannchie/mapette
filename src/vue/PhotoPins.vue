<script setup lang="ts">
// 放大到街区级别时，视野里的点直接显示照片：按屏幕位置挑出互不重叠的若干个，带指向位置的小尖角。
// 照片地址由使用方按需给出（可以异步，例如按分片加载详情）。
import type { MapGeoJSONFeature } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import type { Point } from "geojson";
import { onBeforeUnmount, watch } from "vue";
import { useMap } from "./context";
import { retryImage } from "./imageRetry";

type Key = string | number;

const props = withDefaults(defineProps<{
  /** 从这些图层里取点 */
  layers: string[];
  /** 点 → 唯一键，默认 feature.id，其次 properties.id */
  featureKey?: (f: MapGeoJSONFeature) => Key;
  /** 一批点 → 各自的照片地址（顺序对应，没有照片给 null） */
  images: (features: MapGeoJSONFeature[]) => (string | null)[] | Promise<(string | null)[]>;
  /** 高亮的点（键） */
  focus?: Key | null;
  minZoom?: number;
  max?: number;
  /** 屏幕上两张照片中心的最小距离（px），太近的跳过 */
  gap?: number;
}>(), {
  featureKey: (f: MapGeoJSONFeature) => (f.id ?? f.properties?.id) as Key,
  focus: null,
  minZoom: 16,
  max: 30,
  gap: 120,
});

const emit = defineEmits<{ pick: [feature: MapGeoJSONFeature, key: Key] }>();

const { map } = useMap();
const markers = new Map<Key, maplibregl.Marker>();
let seq = 0;

function clear() {
  for (const marker of markers.values()) marker.remove();
  markers.clear();
}

async function sync() {
  const m = map.value;
  if (!m) return;
  const id = ++seq;
  if (m.getZoom() < props.minZoom) {
    clear();
    return;
  }
  const layers = props.layers.filter((l) => m.getLayer(l));
  const picked: { f: MapGeoJSONFeature; key: Key; lngLat: [number, number]; x: number; y: number }[] = [];
  for (const f of m.queryRenderedFeatures({ layers })) {
    const key = props.featureKey(f);
    const lngLat = (f.geometry as Point).coordinates as [number, number];
    const { x, y } = m.project(lngLat);
    if (picked.some((q) => q.key === key || Math.hypot(q.x - x, q.y - y) < props.gap)) continue;
    picked.push({ f, key, lngLat, x, y });
    if (picked.length >= props.max) break;
  }
  const srcs = await props.images(picked.map((q) => q.f));
  if (id !== seq) return;
  const keep = new Set<Key>();
  picked.forEach((q, i) => {
    const src = srcs[i];
    if (!src) return;
    keep.add(q.key);
    if (markers.has(q.key)) return;
    const el = document.createElement("button");
    el.className = props.focus === q.key ? "meisho-photo-pin focus" : "meisho-photo-pin";
    const img = document.createElement("img");
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    // 失败重试；仍然加载不出来就把这个标记藏起来，地图上不留破图
    img.addEventListener("error", () => retryImage(img, () => (el.style.display = "none")));
    img.src = src;
    el.append(img);
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      emit("pick", q.f, q.key);
    });
    markers.set(q.key, new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -8] }).setLngLat(q.lngLat).addTo(m));
  });
  for (const [key, marker] of markers) {
    if (!keep.has(key)) {
      marker.remove();
      markers.delete(key);
    }
  }
}

watch(map, (m, prev) => {
  prev?.off("moveend", sync);
  if (!m) return;
  m.on("moveend", sync);
  m.once("idle", sync); // 直接从带视野的链接打开时没有 moveend
}, { immediate: true });
watch(() => props.focus, (key) => {
  for (const [k, marker] of markers) marker.getElement().classList.toggle("focus", k === key);
});
onBeforeUnmount(() => {
  map.value?.off("moveend", sync);
  clear();
});

defineExpose({ refresh: sync });
</script>

<template>
  <span hidden />
</template>

<style>
.meisho-photo-pin {
  /* 不要设 position：maplibre 靠 .maplibregl-marker 的 absolute 与 transform 定位标记 */
  display: block;
  width: 112px;
  height: 76px;
  padding: 3px;
  background: #ffffff;
  border: 0;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.18);
  cursor: pointer;
}
/* 选中的照片：主题色描边，并压在其他照片上面 */
.maplibregl-marker:has(.meisho-photo-pin.focus) {
  z-index: 1;
}
.meisho-photo-pin.focus,
.meisho-photo-pin.focus::after {
  background: var(--meisho-accent);
}
.meisho-photo-pin::after {
  /* 指向位置的小尖角 */
  content: "";
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 12px;
  height: 12px;
  background: #ffffff;
  transform: translateX(-50%) rotate(45deg);
  border-radius: 0 0 2px 0;
}
.meisho-photo-pin img {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 7px;
  background: #e5e7eb;
}
</style>
