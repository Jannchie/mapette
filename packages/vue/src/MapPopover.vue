<script setup lang="ts">
// 地图上的弹出卡片：放在 <MapView>（或 MapExplorer 的 #map）里，lngLat 有值时显示，指向那个位置。
// 定位、翻转、避开面板由 @mapette/core 的 MapPopover（Floating UI）负责；内容写在默认插槽里。
import { kitText, MapPopover as CorePopover, type PopoverOptions } from "@mapette/core";
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { useMap } from "./context";

const props = withDefaults(defineProps<{
  /** 指向的位置；null 时不显示 */
  lngLat: [number, number] | null;
  placement?: PopoverOptions["placement"];
  /** 菜单形态：从点击处展开、没有箭头，可以盖住点，优先完整显示 */
  menu?: boolean;
  closeLabel?: string;
}>(), { placement: undefined, menu: false, closeLabel: undefined });

const emit = defineEmits<{ close: [] }>();

const { controller, locale } = useMap();
const el = ref<HTMLElement>();
const arrowEl = ref<HTMLElement>();
const popover = shallowRef<CorePopover | null>(null);

function sync() {
  const ctrl = controller.value;
  const p = props.lngLat;
  if (!ctrl || !p || !el.value) {
    popover.value?.remove();
    popover.value = null;
    return;
  }
  if (popover.value) popover.value.setLngLat(p);
  else popover.value = new CorePopover(ctrl, el.value, p, arrowEl.value, { menu: props.menu, ...(props.placement ? { placement: props.placement } : {}) });
}

// 卡片在 lngLat 有值时才渲染，等 DOM 出来再交给 core
watch([controller, () => props.lngLat?.[0], () => props.lngLat?.[1]], () => void nextTick(sync), { immediate: true });
onBeforeUnmount(() => popover.value?.remove());
</script>

<template>
  <div v-if="lngLat" ref="el" class="mapette-popover" role="dialog">
    <button type="button" class="mapette-popover-close" :title="closeLabel ?? kitText(locale).close" :aria-label="closeLabel ?? kitText(locale).close" @click="emit('close')">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
    <div class="mapette-popover-body"><slot /></div>
    <div ref="arrowEl" class="mapette-popover-arrow" />
  </div>
</template>
