// 机位相关的几何：等效焦距换算视角、沿拍摄朝向张开的取景扇形
import type { Feature, Polygon } from "geojson";

/** 35mm 等效焦距 → 水平视角（度）；不知道焦距时返回 fallback */
export function fieldOfView(focal35: number | null | undefined, fallback = 60): number {
  if (!focal35) return fallback;
  return (2 * Math.atan(36 / (2 * focal35)) * 180) / Math.PI;
}

/**
 * 以机位为顶点、沿拍摄朝向张开的扇形。
 * heading：正北为 0°，顺时针；fov：视角（度）；radius：半径（米）。
 * 距离很短，按等距圆柱近似即可。
 */
export function viewCone(lng: number, lat: number, heading: number, fov: number, radius = 160, steps = 24): Feature<Polygon> {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  const ring: [number, number][] = [[lng, lat]];
  for (let k = 0; k <= steps; k++) {
    const bearing = ((heading - fov / 2 + (fov * k) / steps) * Math.PI) / 180;
    ring.push([lng + (radius * Math.sin(bearing)) / mPerDegLng, lat + (radius * Math.cos(bearing)) / mPerDegLat]);
  }
  ring.push([lng, lat]);
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} };
}

/** 两点间的近似距离（米），用于很近的点之间比较 */
export function distance(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dy = (lat2 - lat1) * 111_320;
  const dx = (lng2 - lng1) * 111_320 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

/** 导航链接：到达该坐标 */
export const directions = {
  google: (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  apple: (lat: number, lng: number) => `https://maps.apple.com/?daddr=${lat},${lng}`,
};
