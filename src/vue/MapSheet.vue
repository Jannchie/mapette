<script setup lang="ts">
// 浮在地图上的面板：桌面端停在左侧，手机端（≤ 640px）是底部抽屉，可拖动、甩动，吸附到收起 / 半屏 / 全屏三档。
// 面板挡住的区域通过 update:padding 报出去，交给 <MapView :padding> 让地图的可视中心避开它。
import type { PaddingOptions } from "maplibre-gl";
import { onBeforeUnmount, onMounted, ref } from "vue";

export type SheetSnap = "peek" | "half" | "full";

const props = withDefaults(defineProps<{
  /** 收起时露出的高度（px） */
  peekHeight?: number;
  /** 半屏占视口高度的比例 */
  halfRatio?: number;
  /** 全屏时顶部留给地图的高度（px） */
  fullGap?: number;
}>(), { peekHeight: 84, halfRatio: 0.46, fullGap: 48 });

const snap = defineModel<SheetSnap>("snap", { default: "half" });
const emit = defineEmits<{ "update:padding": [padding: PaddingOptions] }>();

const panel = ref<HTMLElement>();
const SNAPS: SheetSnap[] = ["peek", "half", "full"];
/** 各档高度（px），和下面 CSS 里 .meisho-sheet-* 的高度对应 */
const snapHeight = (s: SheetSnap) => (s === "peek" ? props.peekHeight : s === "half" ? innerHeight * props.halfRatio : innerHeight - props.fullGap);

let drag: { y: number; height: number; lastY: number; lastT: number; v: number } | null = null;
// 拖动中的高度直接写到面板的 style 上，不经过响应式：每帧重渲染整个面板太重
let dragHeight: number | null = null;
function onHandleDown(e: PointerEvent) {
  drag = { y: e.clientY, height: panel.value!.getBoundingClientRect().height, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function onHandleMove(e: PointerEvent) {
  if (!drag) return;
  if (e.timeStamp > drag.lastT) drag.v = (e.clientY - drag.lastY) / (e.timeStamp - drag.lastT); // px/ms，向下为正
  drag.lastY = e.clientY;
  drag.lastT = e.timeStamp;
  // 位移很小时仍算轻点，不进入拖动
  if (dragHeight != null || Math.abs(e.clientY - drag.y) > 6) {
    dragHeight = Math.max(72, drag.height + drag.y - e.clientY);
    panel.value!.style.transition = "none";
    panel.value!.style.height = `${dragHeight}px`;
  }
}
function onHandleUp() {
  const h = dragHeight;
  if (!drag || h == null) {
    // 轻点把手：半屏 → 收起，其余 → 半屏
    snap.value = snap.value === "half" ? "peek" : "half";
  } else if (Math.abs(drag.v) > 0.4) {
    // 快速甩动：顺着方向切到下一档
    const down = drag.v > 0;
    const next = down ? [...SNAPS].reverse().find((s) => snapHeight(s) < h - 1) : SNAPS.find((s) => snapHeight(s) > h + 1);
    snap.value = next ?? (down ? "peek" : "full");
  } else {
    // 慢慢拖：停到最近的一档
    snap.value = SNAPS.reduce((a, b) => (Math.abs(snapHeight(b) - h) < Math.abs(snapHeight(a) - h) ? b : a));
  }
  drag = null;
  dragHeight = null;
  panel.value!.style.transition = "";
  panel.value!.style.height = "";
  measure();
}

// ---- 面板挡住的区域：桌面端在左侧，手机端在底部 ----
let last = "";
function measure() {
  if (drag || !panel.value) return; // 拖动中不跟着改地图留白，松手停稳后再量一次
  const r = panel.value.getBoundingClientRect();
  const beside = r.width < innerWidth * 0.6;
  const next = beside
    ? { top: 0, right: 0, bottom: 0, left: Math.round(r.right) }
    : { top: 0, right: 0, bottom: Math.round(innerHeight - r.top), left: 0 };
  const key = `${next.left},${next.bottom}`;
  if (key !== last) {
    last = key;
    emit("update:padding", next);
  }
}
let observer: ResizeObserver | undefined;
onMounted(() => {
  observer = new ResizeObserver(measure);
  observer.observe(panel.value!);
  observer.observe(document.documentElement);
  measure();
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <aside ref="panel" class="meisho-sheet" :class="`meisho-sheet-${snap}`" :style="{ '--peek': `${peekHeight}px`, '--half': `${halfRatio * 100}dvh`, '--full-gap': `${fullGap}px` }">
    <div class="meisho-sheet-handle" @pointerdown="onHandleDown" @pointermove="onHandleMove" @pointerup="onHandleUp" @pointercancel="onHandleUp" />
    <header v-if="$slots.header" class="meisho-sheet-header"><slot name="header" /></header>
    <div class="meisho-sheet-body"><slot /></div>
    <footer v-if="$slots.footer" class="meisho-sheet-footer"><slot name="footer" /></footer>
  </aside>
</template>

<style>
.meisho-sheet {
  position: absolute;
  top: 12px;
  left: 12px;
  bottom: 12px;
  width: var(--meisho-sheet-width, 380px);
  display: flex;
  flex-direction: column;
  color: var(--meisho-fg);
  background: var(--meisho-bg);
  border-radius: 16px;
  box-shadow: var(--meisho-shadow);
  backdrop-filter: var(--meisho-glass);
  overflow: hidden;
  box-sizing: border-box;
}
.meisho-sheet-handle {
  display: none;
}
.meisho-sheet-header,
.meisho-sheet-footer {
  flex: none;
}
.meisho-sheet-header {
  border-bottom: 1px solid var(--meisho-line);
}
.meisho-sheet-footer {
  border-top: 1px solid var(--meisho-line);
}
.meisho-sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--meisho-scroll-thumb) transparent;
}
@media (max-width: 640px) {
  .meisho-sheet {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    padding-bottom: env(safe-area-inset-bottom);
    border-radius: 16px 16px 0 0;
    transition: height 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .meisho-sheet-peek {
    height: calc(var(--peek) + env(safe-area-inset-bottom));
  }
  .meisho-sheet-half {
    height: var(--half);
  }
  .meisho-sheet-full {
    height: calc(100dvh - var(--full-gap) - env(safe-area-inset-top));
  }
  .meisho-sheet-handle {
    display: block;
    flex: none;
    height: 22px;
    margin-bottom: -10px;
    touch-action: none;
    cursor: grab;
  }
  .meisho-sheet-handle::before {
    content: "";
    display: block;
    width: 36px;
    height: 5px;
    margin: 8px auto 0;
    border-radius: 3px;
    background: var(--meisho-muted);
    opacity: 0.45;
  }
}
</style>
