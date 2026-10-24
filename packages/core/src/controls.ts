// 浮在地图上的控件：比例尺与定位、缩放按钮。直接挂在地图容器里（不进 maplibre 的四角容器），
// 用 --mapette-pad-left / --mapette-pad-bottom 避开浮层面板。图标是内联 SVG，不依赖图标库。
import type { GeolocateControl } from "maplibre-gl";
import type { MapController } from "./map";

const svg = (path: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const ICONS = {
  locate: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
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
  labels?: { locate?: string; zoomIn?: string; zoomOut?: string };
}

/** 右下角的定位与缩放按钮。定位用 maplibre 自带的控件画位置点，按钮换成自己的，原按钮用 CSS 隐藏 */
export class MapButtons {
  readonly el = document.createElement("div");
  private geolocate: GeolocateControl | null = null;

  constructor(private ctrl: MapController, o: MapButtonsOptions = {}) {
    const labels = { locate: "Locate", zoomIn: "Zoom in", zoomOut: "Zoom out", ...o.labels };
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

  remove() {
    if (this.geolocate && this.ctrl.map.hasControl(this.geolocate)) this.ctrl.map.removeControl(this.geolocate);
    this.el.remove();
  }
}
