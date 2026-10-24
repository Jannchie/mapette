<script setup lang="ts">
// 右下角的定位与缩放按钮。定位用 maplibre 自带的控件画位置点，按钮换成自己的，原按钮用 CSS 隐藏
import { IconLocate, IconMinus, IconPlus } from "@jannchie/icons";
import { JIcon } from "@jannchie/icons-vue";
import maplibregl from "maplibre-gl";
import { onBeforeUnmount, watch } from "vue";
import { useMap } from "./context";

const props = withDefaults(defineProps<{
  locate?: boolean;
  labels?: { locate: string; zoomIn: string; zoomOut: string };
}>(), {
  locate: true,
  labels: () => ({ locate: "Locate", zoomIn: "Zoom in", zoomOut: "Zoom out" }),
});

const { map, padding } = useMap();
let geolocate: maplibregl.GeolocateControl | null = null;

watch(map, (m) => {
  if (!m || !props.locate || geolocate) return;
  geolocate = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true });
  m.addControl(geolocate, "bottom-right");
}, { immediate: true });
onBeforeUnmount(() => {
  if (geolocate) map.value?.removeControl(geolocate);
});

defineExpose({ locate: () => geolocate?.trigger() });
</script>

<template>
  <div class="meisho-controls" :style="{ '--pad-bottom': `${padding.bottom ?? 0}px` }">
    <button v-if="locate" :title="labels.locate" :aria-label="labels.locate" @click="geolocate?.trigger()"><JIcon :icon="IconLocate" /></button>
    <div class="meisho-controls-group">
      <button :title="labels.zoomIn" :aria-label="labels.zoomIn" @click="map?.zoomIn()"><JIcon :icon="IconPlus" /></button>
      <button :title="labels.zoomOut" :aria-label="labels.zoomOut" @click="map?.zoomOut()"><JIcon :icon="IconMinus" /></button>
    </div>
  </div>
</template>

<style>
.meisho-controls {
  position: absolute;
  right: 12px;
  bottom: calc(var(--pad-bottom, 0px) + 36px);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.meisho-controls-group {
  display: flex;
  flex-direction: column;
}
.meisho-controls button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--meisho-fg);
  background: var(--meisho-bg);
  border: 0;
  border-radius: 10px;
  box-shadow: var(--meisho-shadow);
  backdrop-filter: var(--meisho-glass);
  cursor: pointer;
}
.meisho-controls-group button:first-child {
  border-radius: 10px 10px 0 0;
  box-shadow: var(--meisho-shadow), inset 0 -0.5px 0 var(--meisho-line);
}
.meisho-controls-group button:last-child {
  border-radius: 0 0 10px 10px;
}
.meisho-controls button:hover {
  background: var(--meisho-hover);
}
</style>
