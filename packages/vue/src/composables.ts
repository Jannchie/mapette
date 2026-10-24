import { applyThemePref, nextThemePref, readThemePref, saveThemePref, watchDarkMode, watchViewportFeatures, type MapController, type ThemePref, type ViewportFeature, type ViewportOptions } from "@mapette/core";
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

/**
 * 外观偏好（跟随系统 / 浅色 / 深色），存在 localStorage[storageKey]。同一个 key 在页面里共享一份状态：
 * 页脚的切换按钮、站点的快捷键（T）改的是同一个。首屏防闪烁见 themeInitScript
 */
const themePrefs = new Map<string, Ref<ThemePref>>();
export function useThemePref(storageKey: string) {
  let pref = themePrefs.get(storageKey);
  if (!pref) {
    pref = ref<ThemePref>("auto");
    themePrefs.set(storageKey, pref);
  }
  const p = pref;
  onMounted(() => {
    const saved = readThemePref(storageKey);
    if (saved !== p.value) p.value = saved;
  });
  function set(next: ThemePref) {
    applyThemePref(next);
    saveThemePref(storageKey, next);
    p.value = next;
  }
  return { pref: readonly(p), set, cycle: () => set(nextThemePref(p.value)) };
}
