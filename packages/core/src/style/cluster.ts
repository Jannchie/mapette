// 聚合气泡：缩小时相邻的点合成一个带数量的气泡，放大时逐级拆开，拆到底就是单个的点（pointLayer）。
// 合并、拆开由 maplibre 在 worker 里按缩放级别完成；点击展开见 controls 里的 ClusterExpander。
import type { DataDrivenPropertyValueSpecification, ExpressionSpecification, FilterSpecification, GeoJSONSource, GeoJSONSourceSpecification, LayerSpecification, Map as MaplibreMap } from "maplibre-gl";
import { FONT_BOLD } from "./basemap";
import type { Palette } from "./palette";

/** 只要没被聚合的单个点（给 pointLayer 之类的 filter 用） */
export const UNCLUSTERED: FilterSpecification = ["!", ["has", "point_count"]];
/** 只要聚合气泡 */
export const CLUSTERED: FilterSpecification = ["has", "point_count"];

/** 默认合并半径（屏幕像素）：气泡之间大约隔一个气泡的距离，不会密密麻麻 */
export const CLUSTER_RADIUS = 72;

export interface ClusterOptions {
  /** 合并半径（屏幕像素），越大气泡越少、每个气泡里的点越多 */
  radius?: number;
  /** 这一级以上不再聚合，全部显示成单个点 */
  maxZoom?: number;
  /** 聚合时额外累计的属性，例如只数可见的点：{ visible: ["+", ["case", ["has", "hidden"], 0, 1]] } */
  properties?: GeoJSONSourceSpecification["clusterProperties"];
}

/** 开启聚合的 geojson 数据源 */
export function clusterSource(data: GeoJSONSourceSpecification["data"], o: ClusterOptions = {}, extra: Partial<GeoJSONSourceSpecification> = {}): GeoJSONSourceSpecification {
  return {
    type: "geojson",
    data,
    cluster: true,
    clusterRadius: o.radius ?? CLUSTER_RADIUS,
    clusterMaxZoom: o.maxZoom ?? 13,
    ...(o.properties ? { clusterProperties: o.properties } : {}),
    ...extra,
  };
}

/** 运行时调整聚合（半径、上限），数据不重新加载；例如给用户一个「气泡密度」的设置 */
export function setClusterOptions(map: MaplibreMap, source: string, o: Pick<ClusterOptions, "radius" | "maxZoom">) {
  // maplibre 的 setClusterOptions 没给 cluster 时会把聚合关掉，所以总是带上 cluster: true
  (map.getSource(source) as GeoJSONSource | undefined)?.setClusterOptions({
    cluster: true,
    ...(o.radius !== undefined ? { clusterRadius: o.radius } : {}),
    ...(o.maxZoom !== undefined ? { clusterMaxZoom: o.maxZoom } : {}),
  });
}

/** 数量 → 显示文字：1234 → 1.2k，12345 → 12k */
export function abbreviate(count: ExpressionSpecification): ExpressionSpecification {
  return [
    "case",
    [">=", count, 10000], ["concat", ["to-string", ["round", ["/", count, 1000]]], "k"],
    [">=", count, 1000], ["concat", ["to-string", ["/", ["round", ["/", count, 100]], 10]], "k"],
    ["to-string", count],
  ];
}

export interface ClusterLayerOptions {
  id?: string;
  source: string;
  palette: Palette;
  /** 气泡上显示的数量，默认是聚合的总数 point_count */
  count?: ExpressionSpecification;
  /** 额外的筛选条件（与「只要气泡」合并），例如数量为 0 的气泡不画 */
  filter?: FilterSpecification;
  color?: DataDrivenPropertyValueSpecification<string>;
}

/**
 * 气泡与数量两个图层（id、id-count）。气泡大小随数量分档，主题色填充、白色描边，数字是白色粗体。
 * 放在 createBasemap 的 overlays 里，叠在单个的点下面或上面都可以。
 */
export function clusterLayers({ id = "cluster", source, palette: c, count = ["get", "point_count"], filter, color }: ClusterLayerOptions): LayerSpecification[] {
  const only: FilterSpecification = filter ? ["all", CLUSTERED, filter] as FilterSpecification : CLUSTERED;
  return [
    {
      id,
      type: "circle",
      source,
      filter: only,
      paint: {
        "circle-color": color ?? c.accent,
        "circle-radius": ["step", count, 13, 10, 16, 50, 20, 200, 24, 1000, 29],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-opacity": 0.92,
      },
    },
    {
      id: `${id}-count`,
      type: "symbol",
      source,
      filter: only,
      layout: {
        "text-field": abbreviate(count),
        "text-font": FONT_BOLD,
        "text-size": ["step", count, 11, 1000, 12],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": "#ffffff" },
    },
  ];
}
