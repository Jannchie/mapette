// 浮在地图上的控件：比例尺与定位、缩放按钮。直接挂在地图容器里（不进 maplibre 的四角容器），
// 用 --mapette-pad-left / --mapette-pad-bottom 避开浮层面板。图标是内联 SVG，不依赖图标库。
import type { GeoJSONSource, GeolocateControl, MapLayerMouseEvent } from "maplibre-gl";
import type { Point } from "geojson";
import type { MapController } from "./map";

const svg = (path: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const ICONS = {
  locate: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  // 指北针：北半边用主题色，南半边是前景色的淡色；整个图标随地图的方位角反向转动，始终指向正北
  compass: `<svg class="mapette-compass" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.5 15.5 12h-7Z" fill="var(--mapette-accent)"/><path d="M12 21.5 8.5 12h7Z" fill="currentColor" opacity="0.35"/></svg>`,
};

/**
 * 比例尺：黑白相间的分段尺（像纸质地图），长度取 1、2、5 × 10ⁿ 中不超过 max 像素的最大值。
 * 桌面端在地图可见区域的左下角（面板右侧），手机端在顶部居中（底部是抽屉）
 */
export class ScaleBar {
  readonly el = document.createElement("div");
  private bar = document.createElement("span");
  private label = document.createElement("span");
  private update = () => {
    const m = this.ctrl.map;
    // Web 墨卡托、512px 瓦片：每像素对应的米数随纬度按 cos 缩小
    const mpp = (40075016.686 * Math.cos((m.getCenter().lat * Math.PI) / 180)) / (512 * 2 ** m.getZoom());
    const pow = 10 ** Math.floor(Math.log10(mpp * this.max));
    const meters = [5, 2, 1].map((f) => f * pow).find((d) => d / mpp <= this.max) ?? pow;
    this.bar.style.width = `${Math.round(meters / mpp)}px`;
    this.label.textContent = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
  };

  constructor(private ctrl: MapController, private max = 100) {
    this.el.className = "mapette-scale";
    this.el.setAttribute("aria-hidden", "true");
    this.bar.className = "mapette-scale-bar";
    this.bar.innerHTML = "<i></i><i></i><i></i><i></i>";
    this.el.append(this.bar, this.label);
    ctrl.map.getContainer().append(this.el);
    ctrl.map.on("move", this.update);
    this.update();
  }

  remove() {
    this.ctrl.map.off("move", this.update);
    this.el.remove();
  }
}

export interface MapButtonsOptions {
  locate?: boolean;
  zoom?: boolean;
  /** 指北针：随地图转动指向正北，点一下转回正北、恢复俯视。默认在可以旋转的地图（explore）上显示 */
  compass?: boolean;
  labels?: { locate?: string; zoomIn?: string; zoomOut?: string; resetNorth?: string };
}

/** 右下角的指北针、定位与缩放按钮。定位用 maplibre 自带的控件画位置点，按钮换成自己的，原按钮用 CSS 隐藏 */
export class MapButtons {
  readonly el = document.createElement("div");
  private geolocate: GeolocateControl | null = null;
  private needle: SVGElement | null = null;
  private turn = () => {
    if (this.needle) this.needle.style.transform = `rotate(${-this.ctrl.map.getBearing()}deg)`;
  };

  constructor(private ctrl: MapController, o: MapButtonsOptions = {}) {
    const labels = { locate: "Locate", zoomIn: "Zoom in", zoomOut: "Zoom out", resetNorth: "Reset north", ...o.labels };
    const button = (icon: string, label: string, onClick: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.title = label;
      b.setAttribute("aria-label", label);
      b.innerHTML = icon;
      b.addEventListener("click", onClick);
      return b;
    };
    this.el.className = "mapette-buttons";
    if (o.compass ?? ctrl.preset === "explore") {
      const b = button(ICONS.compass, labels.resetNorth, () => this.resetNorth());
      b.classList.add("mapette-compass-btn");
      this.needle = b.querySelector("svg");
      this.el.append(b);
      ctrl.map.on("rotate", this.turn);
      this.turn();
    }
    if (o.locate !== false) {
      const geolocate = new ctrl.lib.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true });
      ctrl.map.addControl(geolocate, "bottom-right");
      this.geolocate = geolocate;
      this.el.append(button(ICONS.locate, labels.locate, () => this.locate()));
    }
    if (o.zoom !== false) {
      const group = document.createElement("div");
      group.className = "mapette-buttons-group";
      group.append(button(ICONS.plus, labels.zoomIn, () => ctrl.map.zoomIn()), button(ICONS.minus, labels.zoomOut, () => ctrl.map.zoomOut()));
      this.el.append(group);
    }
    ctrl.map.getContainer().append(this.el);
  }

  locate() {
    this.geolocate?.trigger();
  }

  /** 转回正北，同时恢复俯视（倾斜过的话） */
  resetNorth() {
    this.ctrl.map.easeTo({ bearing: 0, pitch: 0, duration: 400 });
  }

  remove() {
    this.ctrl.map.off("rotate", this.turn);
    if (this.geolocate && this.ctrl.map.hasControl(this.geolocate)) this.ctrl.map.removeControl(this.geolocate);
    this.el.remove();
  }
}

/** 点击聚合气泡：放大到它拆开的那一级，以它为中心。鼠标移上去显示手形 */
export class ClusterExpander {
  private click = async (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    const id = f?.properties?.cluster_id;
    if (f == null || id == null) return;
    const source = this.ctrl.map.getSource(f.source) as GeoJSONSource | undefined;
    if (!source) return;
    const m = this.ctrl.map;
    // 拆开的级别可能就是当前级别（缩放有小数时气泡还没来得及拆），至少放大一级，点了总有变化
    const zoom = Math.max(await source.getClusterExpansionZoom(id), m.getZoom() + 1);
    m.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom: Math.min(zoom, m.getMaxZoom()) });
  };
  private enter = () => (this.ctrl.map.getCanvas().style.cursor = "pointer");
  private leave = () => (this.ctrl.map.getCanvas().style.cursor = "");

  /** layers：气泡图层（通常是 clusterLayers 的 id 与 id-count） */
  constructor(private ctrl: MapController, private layers: string[]) {
    for (const l of layers) {
      ctrl.map.on("click", l, this.click);
      ctrl.map.on("mouseenter", l, this.enter);
      ctrl.map.on("mouseleave", l, this.leave);
    }
  }

  remove() {
    for (const l of this.layers) {
      this.ctrl.map.off("click", l, this.click);
      this.ctrl.map.off("mouseenter", l, this.enter);
      this.ctrl.map.off("mouseleave", l, this.leave);
    }
  }
}
