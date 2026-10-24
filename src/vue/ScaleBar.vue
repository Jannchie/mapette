<script setup lang="ts">
// 比例尺：黑白相间的分段尺（像纸质地图），长度取 1、2、5 × 10ⁿ 中不超过 max 像素的最大值。
// 桌面端在地图可见区域的左下角（面板右侧），手机端在顶部居中（底部是抽屉）
import { onBeforeUnmount, ref, watch } from "vue";
import { useMap } from "./context";

const props = withDefaults(defineProps<{ max?: number }>(), { max: 100 });
const { map, padding } = useMap();
const scale = ref<{ width: number; label: string } | null>(null);

function update() {
  const m = map.value;
  if (!m) return;
  // Web 墨卡托、512px 瓦片：每像素对应的米数随纬度按 cos 缩小
  const mpp = (40075016.686 * Math.cos((m.getCenter().lat * Math.PI) / 180)) / (512 * 2 ** m.getZoom());
  const pow = 10 ** Math.floor(Math.log10(mpp * props.max));
  const meters = [5, 2, 1].map((f) => f * pow).find((d) => d / mpp <= props.max) ?? pow;
  scale.value = { width: Math.round(meters / mpp), label: meters >= 1000 ? `${meters / 1000} km` : `${meters} m` };
}

watch(map, (m, prev) => {
  prev?.off("move", update);
  m?.on("move", update);
  update();
}, { immediate: true });
onBeforeUnmount(() => map.value?.off("move", update));
</script>

<template>
  <div v-if="scale" class="meisho-scale" :style="{ '--pad-left': `${padding.left ?? 0}px` }" aria-hidden="true">
    <span class="meisho-scale-bar" :style="{ width: `${scale.width}px` }"><i /><i /><i /><i /></span>
    <span>{{ scale.label }}</span>
  </div>
</template>

<style>
.meisho-scale {
  position: absolute;
  left: calc(var(--pad-left, 0px) + 12px);
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--meisho-fg);
  background: var(--meisho-bg);
  border-radius: 8px;
  box-shadow: var(--meisho-shadow);
  backdrop-filter: var(--meisho-glass);
  pointer-events: none;
}
.meisho-scale-bar {
  display: flex;
  height: 5px;
  border: 1px solid var(--meisho-fg);
  box-sizing: content-box;
}
.meisho-scale-bar i {
  flex: 1;
  background: var(--meisho-fg);
}
.meisho-scale-bar i:nth-child(even) {
  background: var(--meisho-bg-solid);
}
@media (max-width: 640px) {
  .meisho-scale {
    top: calc(env(safe-area-inset-top) + 10px);
    bottom: auto;
    left: 50%;
    transform: translateX(-50%);
  }
}
</style>
