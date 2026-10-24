// 标记：单个位置点（可带脉冲），以及放大后直接显示照片的标记群
import type { MapGeoJSONFeature, Marker } from "maplibre-gl";
import type { Point } from "geojson";
import { retryImage } from "./image-retry";
import type { MapController } from "./map";

/** 一个位置点，颜色跟随 --mapette-accent；pulse 时外圈有扩散的光晕（尊重「减少动态效果」设置） */
export class LocationMarker {
  private marker: Marker;

  constructor(ctrl: MapController, lngLat: [number, number], o: { pulse?: boolean } = {}) {
    const el = document.createElement("div");
    el.className = o.pulse ? "mapette-location pulse" : "mapette-location";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = "<span></span>";
    this.marker = new ctrl.lib.Marker({ element: el }).setLngLat(lngLat).addTo(ctrl.map);
  }

  setLngLat(lngLat: [number, number]) {
    this.marker.setLngLat(lngLat);
  }

  remove() {
    this.marker.remove();
  }
}

type Key = string | number;

export interface PhotoPinsOptions {
  /** 从这些图层里取点 */
  layers: string[];
  /** 一批点 → 各自的照片地址（顺序对应，没有照片给 null），可以异步 */
  images: (features: MapGeoJSONFeature[]) => (string | null)[] | Promise<(string | null)[]>;
  /** 点 → 唯一键，默认 feature.id，其次 properties.id */
  featureKey?: (f: MapGeoJSONFeature) => Key;
  onPick?: (feature: MapGeoJSONFeature, key: Key) => void;
  /** 从这个缩放级别开始显示 */
  minZoom?: number;
  max?: number;
  /** 屏幕上两张照片中心的最小距离（px），太近的跳过 */
  gap?: number;
}

/**
 * 放大到街区级别时，视野里的点直接显示照片：按屏幕位置挑出互不重叠的若干个，带指向位置的小尖角。
 */
export class PhotoPins {
  private markers = new Map<Key, Marker>();
  private seq = 0;
  private focusKey: Key | null = null;
  private o: Required<Omit<PhotoPinsOptions, "onPick">> & Pick<PhotoPinsOptions, "onPick">;
  private sync = () => void this.refresh();
  // 点所在的数据源（几万个点在 worker 里解析要一会儿）加载完、换主题后重新加载完，都要再取一次
  private onData = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (!e.isSourceLoaded) return;
    const sources = this.o.layers.map((l) => this.ctrl.map.getLayer(l)?.source);
    if (sources.includes(e.sourceId)) this.ctrl.map.once("idle", this.sync);
  };

  constructor(private ctrl: MapController, options: PhotoPinsOptions) {
    this.o = {
      featureKey: (f) => (f.id ?? f.properties?.id) as Key,
      minZoom: 16,
      max: 30,
      gap: 120,
      ...options,
    };
    ctrl.map.on("moveend", this.sync);
    ctrl.map.on("sourcedata", this.onData);
    ctrl.map.once("idle", this.sync); // 直接从带视野的链接打开时没有 moveend
  }

  setFocus(key: Key | null) {
    this.focusKey = key;
    for (const [k, marker] of this.markers) marker.getElement().classList.toggle("focus", k === key);
  }

  async refresh() {
    const m = this.ctrl.map;
    const id = ++this.seq;
    if (m.getZoom() < this.o.minZoom) {
      this.clear();
      return;
    }
    const layers = this.o.layers.filter((l) => m.getLayer(l));
    const picked: { f: MapGeoJSONFeature; key: Key; lngLat: [number, number]; x: number; y: number }[] = [];
    for (const f of layers.length ? m.queryRenderedFeatures({ layers }) : []) {
      const key = this.o.featureKey(f);
      const lngLat = (f.geometry as Point).coordinates as [number, number];
      const { x, y } = m.project(lngLat);
      if (picked.some((q) => q.key === key || Math.hypot(q.x - x, q.y - y) < this.o.gap)) continue;
      picked.push({ f, key, lngLat, x, y });
      if (picked.length >= this.o.max) break;
    }
    const srcs = await this.o.images(picked.map((q) => q.f));
    if (id !== this.seq) return;
    const keep = new Set<Key>();
    picked.forEach((q, i) => {
      const src = srcs[i];
      if (!src) return;
      keep.add(q.key);
      if (this.markers.has(q.key)) return;
      const el = document.createElement("button");
      el.type = "button";
      el.className = this.focusKey === q.key ? "mapette-photo-pin focus" : "mapette-photo-pin";
      const img = document.createElement("img");
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      // 失败重试；仍然加载不出来就把这个标记藏起来，地图上不留破图
      img.addEventListener("error", () => retryImage(img, () => (el.style.display = "none")));
      img.src = src;
      el.append(img);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.o.onPick?.(q.f, q.key);
      });
      this.markers.set(q.key, new this.ctrl.lib.Marker({ element: el, anchor: "bottom", offset: [0, -8] }).setLngLat(q.lngLat).addTo(m));
    });
    for (const [key, marker] of this.markers) {
      if (!keep.has(key)) {
        marker.remove();
        this.markers.delete(key);
      }
    }
  }

  private clear() {
    for (const marker of this.markers.values()) marker.remove();
    this.markers.clear();
  }

  remove() {
    this.seq++;
    this.ctrl.map.off("moveend", this.sync);
    this.ctrl.map.off("sourcedata", this.onData);
    this.ctrl.map.off("idle", this.sync);
    this.clear();
  }
}
