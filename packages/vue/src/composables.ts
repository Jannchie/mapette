import { watchDarkMode, watchViewportFeatures, type MapController, type ViewportFeature, type ViewportOptions } from "@mapette/core";
import { onBeforeUnmount, onMounted, readonly, ref, shallowRef, watch, type Ref } from "vue";

/** 视野里的点，按离中心的距离排序；缩放小于 minZoom 时为 null。传入 MapView 的 controller（@load 拿到的） */
export function useViewportFeatures(controller: Ref<MapController | null | undefined>, options: ViewportOptions) {
  const result = shallowRef<ViewportFeature[] | null>(null);
  let stop: (() => void) | null = null;
  watch(controller, (ctrl) => {
    stop?.();
    stop = ctrl ? watchViewportFeatures(ctrl.map, options, (f) => (result.value = f)) : null;
  }, { immediate: true });
  onBeforeUnmount(() => stop?.());
  return result;
}

/** 页面当前是不是深色（data-theme / class="dark" / 系统设置） */
export function useDarkMode() {
  const dark = ref(false);
  let stop: (() => void) | null = null;
  onMounted(() => (stop = watchDarkMode((d) => (dark.value = d))));
  onBeforeUnmount(() => stop?.());
  return readonly(dark);
}
