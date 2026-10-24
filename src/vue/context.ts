// <MapView> 把地图实例和留白提供给里面的组件（控件、比例尺、照片标记）
import type { Map as MaplibreMap, PaddingOptions } from "maplibre-gl";
import { inject, type InjectionKey, type Ref, type ShallowRef } from "vue";

export interface MapContext {
  /** 地图实例；挂载前为 null */
  map: ShallowRef<MaplibreMap | null>;
  /** 样式首次加载完成（换主题时会短暂为 false） */
  ready: Ref<boolean>;
  /** 被浮层面板挡住、实际生效的留白 */
  padding: Ref<PaddingOptions>;
}

export const MAP_CONTEXT: InjectionKey<MapContext> = Symbol("meisho:map");

/** 在 <MapView> 内部的组件里取得地图 */
export function useMap(): MapContext {
  const ctx = inject(MAP_CONTEXT);
  if (!ctx) throw new Error("useMap() must be used inside <MapView>");
  return ctx;
}
