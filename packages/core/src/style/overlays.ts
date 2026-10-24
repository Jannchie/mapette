// 叠加层的现成做法：缩小时是柔和的热度晕染（不显示数字），放大到 HEAT_FADE 区间渐变为可点击的单个点。
// 各站点只需要给出数据源 id，以及（可选）筛选条件。
import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from "maplibre-gl";
import { alpha } from "./basemap";
import type { Palette } from "./palette";

/** 热力图淡出、单个点淡入的缩放区间 */
export const HEAT_FADE: [number, number] = [9, 11];

interface LayerOptions {
  id?: string;
  source: string;
  palette: Palette;
  filter?: FilterSpecification;
  fade?: [number, number];
}

/**
 * 热度晕染：极低密度处透明，按密度由淡紫、品红、珊瑚橙渐变到暖金，最密集处最亮。
 * 放到 createBasemap 的 belowLabels 里，地名会浮在光晕上面。
 */
export function heatmapLayer({ id = "heat", source, palette: c, filter, fade = HEAT_FADE }: LayerOptions): LayerSpecification {
  const [fadeFrom, fadeTo] = fade;
  return {
    id,
    type: "heatmap",
    source,
    maxzoom: fadeTo + 0.5,
    ...(filter ? { filter } : {}),
    paint: {
      "heatmap-weight": 1,
      // 半径偏小，相邻城市不会连成一片
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.02, 4, 0.04, 6, 0.08, 8, 0.18, fadeTo, 0.5],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 3, 4, 6, 6, 9, 8, 14, fadeTo, 24],
      // 节点按指数间隔分布，相当于对密度取对数：上万个点的大城市、几十个点的小城都分得出层次
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0, alpha(c.heat1, 0),
        0.015, alpha(c.heat1, 0),
        0.04, alpha(c.heat1, 0.18),
        0.1, alpha(c.heat2, 0.3),
        0.22, alpha(c.heat3, 0.42),
        0.45, alpha(c.heat4, 0.55),
        1, alpha(c.heat5, 0.68),
      ],
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], fadeFrom, 1, fadeTo, 0],
    },
  };
}

/** 放大后接替热力图的可点击圆点（白描边） */
export function pointLayer({ id = "point", source, palette: c, filter, fade = HEAT_FADE, color }: LayerOptions & { color?: string | ExpressionSpecification }): LayerSpecification {
  const [fadeFrom, fadeTo] = fade;
  return {
    id,
    type: "circle",
    source,
    minzoom: fadeFrom - 0.5,
    ...(filter ? { filter } : {}),
    paint: {
      "circle-color": color ?? c.accent,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], fadeFrom, 3, 12, 4.5, 16, 7, 18, 9],
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], fadeFrom, 0, fadeTo, 1],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], fadeFrom, 1, 16, 2],
      "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], fadeFrom, 0, fadeTo, 1],
    },
  };
}

/** 选中的点：单独画在最上层，稍大一圈，任何缩放级别都看得到。filter 由使用方给出（通常比较 global-state） */
export function focusPointLayer({ id = "focus-point", source, palette: c, filter, color }: Omit<LayerOptions, "fade"> & { color?: string | ExpressionSpecification }): LayerSpecification {
  return {
    id,
    type: "circle",
    source,
    ...(filter ? { filter } : {}),
    paint: {
      "circle-color": color ?? c.accent,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 6, 16, 10, 18, 12],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  };
}

/** 取景扇形（配合 geometry.ts 的 viewCone）：半透明填充加描边 */
export function coneLayers({ id = "cone", source, palette: c }: Omit<LayerOptions, "fade" | "filter">): LayerSpecification[] {
  return [
    { id, type: "fill", source, paint: { "fill-color": c.accent, "fill-opacity": 0.18 } },
    { id: `${id}-edge`, type: "line", source, paint: { "line-color": c.accent, "line-width": 1.5, "line-opacity": 0.7 } },
  ];
}
