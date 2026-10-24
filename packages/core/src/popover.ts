// 地图上的弹出卡片：指向一个位置，始终留在地图的可见区域（避开侧栏 / 抽屉）里。
// 定位交给 Floating UI：上方放不下就翻到下方，左右放不下就平移；位置被拖出可见区域时隐藏卡片。
// 两种形态：默认是带箭头、指着点的卡片；menu 是菜单——从点击处展开、没有箭头，
// 放不下时可以整个滑过去盖住那个点，优先完整显示、不出现滚动。
// 卡片元素由使用方提供（框架渲染的内容），这里只负责摆放、箭头和跟随地图移动。
import { arrow, computePosition, flip, hide, offset, shift, size, type Placement, type Rect, type VirtualElement } from "@floating-ui/dom";
import type { MapController } from "./map";

export interface PopoverOptions {
  /** 优先摆放的方向，默认在点的上方 */
  placement?: Placement;
  /** 卡片与点的距离（px） */
  offset?: number;
  /** 卡片与可见区域边缘至少留出的距离（px） */
  padding?: number;
  /** 菜单形态：没有箭头，两个方向都可以平移（可以盖住点），高度只受整个可见区域限制 */
  menu?: boolean;
}

export class MapPopover {
  private lngLat: [number, number];
  private o: Required<PopoverOptions>;
  // maplibre 每渲染一帧触发一次 move，直接在里面重新定位，拖动时卡片紧跟着点。
  // （不要再套一层 requestAnimationFrame 并取消上一帧：move 正是在帧回调里触发的，会把每一帧的更新都取消掉，停下才动）
  private update = () => void this.place();
  // 内容常常是异步出来的（列表、图片），卡片长高后要重新定位，否则会按打开时的小尺寸摆放、超出可见区域
  private resize = new ResizeObserver(this.update);

  /** el：卡片（会被设为 absolute，定位相对于它的 offsetParent）；arrowEl：可选的小箭头 */
  constructor(private ctrl: MapController, private el: HTMLElement, lngLat: [number, number], private arrowEl?: HTMLElement | null, options: PopoverOptions = {}) {
    this.lngLat = lngLat;
    this.o = options.menu
      ? { placement: "bottom-start", offset: 4, padding: 12, menu: true, ...options }
      : { placement: "top", offset: 14, padding: 12, menu: false, ...options };
    el.classList.add("mapette-popover");
    el.style.position = "absolute";
    el.style.left = "0";
    el.style.top = "0";
    ctrl.map.on("move", this.update);
    ctrl.map.on("resize", this.update);
    ctrl.map.on("mapette:popovers", this.update);
    this.resize.observe(el);
    void this.place();
  }

  setLngLat(lngLat: [number, number]) {
    this.lngLat = lngLat;
    void this.place();
  }

  /** 点在屏幕上的位置，作为 Floating UI 的参照物 */
  private reference(): VirtualElement {
    const box = this.ctrl.map.getContainer().getBoundingClientRect();
    const p = this.ctrl.map.project(this.lngLat);
    const x = box.left + p.x;
    const y = box.top + p.y;
    return { getBoundingClientRect: () => ({ x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 }) };
  }

  /** 地图里没被面板挡住的区域（视口坐标） */
  private visibleArea(): Rect {
    const box = this.ctrl.map.getContainer().getBoundingClientRect();
    const q = this.ctrl.getPadding();
    const left = box.left + (q.left ?? 0);
    const top = box.top + (q.top ?? 0);
    return { x: left, y: top, width: box.right - (q.right ?? 0) - left, height: box.bottom - (q.bottom ?? 0) - top };
  }

  private async place() {
    // 卡片形态的弹出卡片可以整体关掉（createMap 的 popovers，默认关闭）；菜单形态不受影响
    const off = !this.o.menu && !this.ctrl.popovers;
    this.el.style.display = off ? "none" : "";
    if (off) return;
    const area = this.visibleArea();
    const { x, y, placement, middlewareData } = await computePosition(this.reference(), this.el, {
      placement: this.o.placement,
      strategy: "absolute",
      middleware: [
        offset(this.o.offset),
        flip({ rootBoundary: area, padding: this.o.padding }),
        // 菜单：垂直于展开方向的轴也平移，放不下就滑过去盖住点，换取完整显示
        shift({ rootBoundary: area, padding: this.o.padding, crossAxis: this.o.menu }),
        // 太高时限制高度，内容在卡片里滚动（--mapette-popover-max-height，见 mapette.css）。
        // 卡片：受点那一侧剩余空间限制；菜单：可以盖住点，只受整个可见区域限制
        size({
          rootBoundary: area,
          padding: this.o.padding,
          apply: ({ availableHeight }) => {
            const h = this.o.menu ? area.height - 2 * this.o.padding : availableHeight;
            this.el.style.setProperty("--mapette-popover-max-height", `${Math.max(120, Math.floor(h))}px`);
          },
        }),
        ...(this.arrowEl && !this.o.menu ? [arrow({ element: this.arrowEl, padding: 12 })] : []),
        hide({ rootBoundary: area }),
      ],
    });
    this.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    this.el.dataset.placement = placement;
    this.el.classList.toggle("mapette-popover-menu", this.o.menu);
    // 点被拖出可见区域（或藏到面板后面）时，卡片跟着隐藏，不贴在边上
    this.el.style.visibility = middlewareData.hide?.referenceHidden ? "hidden" : "";
    const a = middlewareData.arrow;
    if (this.arrowEl && a) {
      this.arrowEl.style.left = a.x != null ? `${a.x}px` : "";
      this.arrowEl.style.top = a.y != null ? `${a.y}px` : "";
    }
  }

  remove() {
    this.resize.disconnect();
    this.ctrl.map.off("move", this.update);
    this.ctrl.map.off("resize", this.update);
    this.ctrl.map.off("mapette:popovers", this.update);
    this.el.classList.remove("mapette-popover");
  }
}
