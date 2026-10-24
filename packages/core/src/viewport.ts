// 视野里的点，按离（避开面板后的）中心的距离排序：用来在面板里列出「附近」的内容。
import type { Map as MaplibreMap, MapGeoJSONFeature } from "maplibre-gl";
import type { Point } from "geojson";

export interface ViewportFeature {
  feature: MapGeoJSONFeature;
  lngLat: [number, number];
  /** 离中心的屏幕距离（px） */
  distance: number;
}

export interface ViewportOptions {
  layers: string[];
  /** 等这个数据源加载完再做第一次统计（几万个点的源在 worker 里解析需要时间） */
  source?: string;
  /** 缩放小于它（还在热力图阶段）时回调 null */
  minZoom?: number;
  limit?: number;
  /** 点 → 唯一键，同一个点在瓦片边界上可能被查到两次 */
  featureKey?: (f: MapGeoJSONFeature) => string | number;
}

/** 视野变化（拖动、缩放结束）时回调，返回取消函数 */
export function watchViewportFeatures(map: MaplibreMap, o: ViewportOptions, callback: (features: ViewportFeature[] | null) => void): () => void {
  const key = o.featureKey ?? ((f: MapGeoJSONFeature) => (f.id ?? f.properties?.id) as string | number);

  function update() {
    if (map.getZoom() < (o.minZoom ?? 0)) return callback(null);
    const center = map.project(map.getCenter());
    const seen = new Set<string | number>();
    const out: ViewportFeature[] = [];
    const layers = o.layers.filter((l) => map.getLayer(l));
    for (const f of layers.length ? map.queryRenderedFeatures({ layers }) : []) {
      const k = key(f);
      if (seen.has(k)) continue;
      seen.add(k);
      const lngLat = (f.geometry as Point).coordinates as [number, number];
      const { x, y } = map.project(lngLat);
      out.push({ feature: f, lngLat, distance: Math.hypot(x - center.x, y - center.y) });
    }
    out.sort((a, b) => a.distance - b.distance);
    callback(o.limit ? out.slice(0, o.limit) : out);
  }

  function onData(e: { sourceId?: string; isSourceLoaded?: boolean }) {
    if (e.sourceId === o.source && e.isSourceLoaded) {
      map.off("sourcedata", onData);
      map.once("idle", update);
    }
  }

  map.on("moveend", update);
  if (o.source) map.on("sourcedata", onData);
  else map.once("idle", update);
  return () => {
    map.off("moveend", update);
    map.off("sourcedata", onData);
    map.off("idle", update);
  };
}
