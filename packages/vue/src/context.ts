// <MapView> 把地图控制器提供给里面的组件（控件、比例尺、标记）
import type { MapController } from "@mapette/core";
import { inject, onBeforeUnmount, shallowRef, watch, type InjectionKey, type ShallowRef } from "vue";

export interface MapContext {
  /** 地图控制器；地图异步创建，创建完成前为 null */
  controller: ShallowRef<MapController | null>;
}

export const MAP_CONTEXT: InjectionKey<MapContext> = Symbol("mapette:map");

/** 在 <MapView> 内部的组件里取得地图控制器 */
export function useMap(): MapContext {
  const ctx = inject(MAP_CONTEXT);
  if (!ctx) throw new Error("useMap() must be used inside <MapView>");
  return ctx;
}

/**
 * 地图就绪后创建一个 core 对象（控件、标记……），卸载时移除。
 * 父组件 MapView 在 unmounted 才销毁地图，这里的 beforeUnmount 一定先执行。
 */
export function useMapObject<T extends { remove(): void }>(create: (ctrl: MapController) => T): ShallowRef<T | null> {
  const { controller } = useMap();
  const obj = shallowRef(null) as ShallowRef<T | null>;
  watch(controller, (ctrl) => {
    obj.value?.remove();
    obj.value = ctrl ? create(ctrl) : null;
  }, { immediate: true });
  onBeforeUnmount(() => obj.value?.remove());
  return obj;
}
