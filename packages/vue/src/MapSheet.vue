<script setup lang="ts">
// 浮在地图上的面板：桌面端停在左侧，手机端是可拖动的底部抽屉（行为在 @mapette/core 的 Sheet 里）。
// 面板挡住的区域通过 update:padding 报出去，交给 <MapView :padding>。
import { Sheet, type SheetSnap } from "@mapette/core";
import type { PaddingOptions } from "maplibre-gl";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(defineProps<{
  peekHeight?: number;
  halfRatio?: number;
  fullGap?: number;
}>(), { peekHeight: 84, halfRatio: 0.46, fullGap: 48 });

const snap = defineModel<SheetSnap>("snap", { default: "half" });
const emit = defineEmits<{ "update:padding": [padding: PaddingOptions] }>();

const el = ref<HTMLElement>();
const handle = ref<HTMLElement>();
let sheet: Sheet | null = null;

onMounted(() => {
  sheet = new Sheet(el.value!, handle.value!, {
    ...props,
    snap: snap.value,
    onSnap: (s) => (snap.value = s),
    onPadding: (p) => emit("update:padding", p),
  });
});
onBeforeUnmount(() => sheet?.destroy());
defineExpose({ el });
watch(snap, (s) => sheet?.setSnap(s));
</script>

<template>
  <aside ref="el" class="mapette-sheet">
    <div ref="handle" class="mapette-sheet-handle" />
    <header v-if="$slots.header" class="mapette-sheet-header"><slot name="header" /></header>
    <div class="mapette-sheet-body"><slot /></div>
    <footer v-if="$slots.footer" class="mapette-sheet-footer"><slot name="footer" /></footer>
  </aside>
</template>
