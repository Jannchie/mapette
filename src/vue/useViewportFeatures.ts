// 视野里的点，按离（避开面板后的）中心的距离排序：用来在面板里列出「附近」的内容。
// 缩放小于 minZoom（还在热力图阶段）时为 null。
import type { Map as MaplibreMap, MapGeoJSONFeature } from "maplibre-gl";
import type { Point } from "geojson";
import { onBeforeUnmount, shallowRef, watch, type Ref } from "vue";

export interface ViewportFeature {
  feature: MapGeoJSONFeature;
  lngLat: [number, number];
  /** 离中心的屏幕距离（px） */
  distance: number;
}

export function useViewportFeatures(
  map: Ref<MaplibreMap | null | undefined>,
  options: {
    layers: string[];
    /** 等这个数据源加载完再做第一次统计（几万个点的源在 worker 里解析需要时间） */
    source?: string;
    minZoom?: number;
    limit?: number;
    /** 点 → 唯一键，同一个点在瓦片边界上可能被查到两次 */
    featureKey?: (f: MapGeoJSONFeature) => string | number;
  },
) {
  const result = shallowRef<ViewportFeature[] | null>(null);
  const key = options.featureKey ?? ((f: MapGeoJSONFeature) => (f.id ?? f.properties?.id) as string | number);

  function update() {
    const m = map.value;
    if (!m) return;
    if (m.getZoom() < (options.minZoom ?? 0)) {
      result.value = null;
      return;
    }
    const center = m.project(m.getCenter());
    const seen = new Set<string | number>();
    const out: ViewportFeature[] = [];
    for (const f of m.queryRenderedFeatures({ layers: options.layers.filter((l) => m.getLayer(l)) })) {
      const k = key(f);
      if (seen.has(k)) continue;
      seen.add(k);
      const lngLat = (f.geometry as Point).coordinates as [number, number];
      const { x, y } = m.project(lngLat);
      out.push({ feature: f, lngLat, distance: Math.hypot(x - center.x, y - center.y) });
    }
    out.sort((a, b) => a.distance - b.distance);
    result.value = options.limit ? out.slice(0, options.limit) : out;
  }

  function onData(e: { sourceId?: string; isSourceLoaded?: boolean }) {
    if (e.sourceId === options.source && e.isSourceLoaded) {
      map.value?.off("sourcedata", onData);
      map.value?.once("idle", update);
    }
  }

  watch(map, (m, prev) => {
    prev?.off("moveend", update);
    prev?.off("sourcedata", onData);
    if (!m) return;
    m.on("moveend", update);
    if (options.source) m.on("sourcedata", onData);
    else m.once("idle", update);
  }, { immediate: true });
  onBeforeUnmount(() => {
    map.value?.off("moveend", update);
    map.value?.off("sourcedata", onData);
  });

  return result;
}
