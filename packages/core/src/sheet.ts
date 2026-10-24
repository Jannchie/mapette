// 浮在地图上的面板：桌面端停在左侧，手机端（≤ 640px，CSS 决定）是底部抽屉，可拖动、甩动，吸附到收起 / 半屏 / 全屏三档。
// 面板挡住的区域通过 onPadding 报出去，交给地图控制器的 setPadding，让地图的可视中心避开它。
import type { PaddingOptions } from "maplibre-gl";

export type SheetSnap = "peek" | "half" | "full";

export interface SheetOptions {
  /** 收起时露出的高度（px） */
  peekHeight?: number;
  /** 半屏占视口高度的比例 */
  halfRatio?: number;
  /** 全屏时顶部留给地图的高度（px） */
  fullGap?: number;
  snap?: SheetSnap;
  onSnap?: (snap: SheetSnap) => void;
  onPadding?: (padding: PaddingOptions) => void;
}

const SNAPS: SheetSnap[] = ["peek", "half", "full"];

/**
 * 给已有的面板元素加上抽屉行为。el 是面板，handle 是手机端的拖动把手。
 * 档位由 el 上的 mapette-sheet-{snap} 类名体现，高度在 CSS 里。
 */
export class Sheet {
  private snap: SheetSnap;
  private o: Required<Omit<SheetOptions, "onSnap" | "onPadding" | "snap">> & SheetOptions;
  private drag: { y: number; height: number; lastY: number; lastT: number; v: number } | null = null;
  // 拖动中的高度直接写到面板的 style 上，不经过框架的响应式：每帧重渲染整个面板太重
  private dragHeight: number | null = null;
  private observer: ResizeObserver;
  private last = "";

  constructor(private el: HTMLElement, private handle: HTMLElement, options: SheetOptions = {}) {
    this.o = { peekHeight: 84, halfRatio: 0.46, fullGap: 48, ...options };
    this.snap = options.snap ?? "half";
    el.classList.add("mapette-sheet");
    el.style.setProperty("--peek", `${this.o.peekHeight}px`);
    el.style.setProperty("--half", `${this.o.halfRatio * 100}dvh`);
    el.style.setProperty("--full-gap", `${this.o.fullGap}px`);
    this.applySnap();
    handle.addEventListener("pointerdown", this.down);
    handle.addEventListener("pointermove", this.move);
    handle.addEventListener("pointerup", this.up);
    handle.addEventListener("pointercancel", this.up);
    this.observer = new ResizeObserver(() => this.measure());
    this.observer.observe(el);
    this.observer.observe(document.documentElement);
    this.measure();
  }

  getSnap() {
    return this.snap;
  }

  setSnap(snap: SheetSnap) {
    if (snap === this.snap) return;
    this.snap = snap;
    this.applySnap();
    this.o.onSnap?.(snap);
  }

  private applySnap() {
    for (const s of SNAPS) this.el.classList.toggle(`mapette-sheet-${s}`, s === this.snap);
  }

  /** 各档高度（px），和 CSS 里 .mapette-sheet-* 的高度对应 */
  private height(s: SheetSnap) {
    return s === "peek" ? this.o.peekHeight : s === "half" ? innerHeight * this.o.halfRatio : innerHeight - this.o.fullGap;
  }

  private down = (e: PointerEvent) => {
    this.drag = { y: e.clientY, height: this.el.getBoundingClientRect().height, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    this.handle.setPointerCapture(e.pointerId);
  };

  private move = (e: PointerEvent) => {
    const d = this.drag;
    if (!d) return;
    if (e.timeStamp > d.lastT) d.v = (e.clientY - d.lastY) / (e.timeStamp - d.lastT); // px/ms，向下为正
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    // 位移很小时仍算轻点，不进入拖动
    if (this.dragHeight != null || Math.abs(e.clientY - d.y) > 6) {
      this.dragHeight = Math.max(72, d.height + d.y - e.clientY);
      this.el.style.transition = "none";
      this.el.style.height = `${this.dragHeight}px`;
    }
  };

  private up = () => {
    const d = this.drag;
    const h = this.dragHeight;
    if (!d) return;
    if (h == null) {
      // 轻点把手：半屏 → 收起，其余 → 半屏
      this.setSnap(this.snap === "half" ? "peek" : "half");
    } else if (Math.abs(d.v) > 0.4) {
      // 快速甩动：顺着方向切到下一档
      const down = d.v > 0;
      const next = down ? [...SNAPS].reverse().find((s) => this.height(s) < h - 1) : SNAPS.find((s) => this.height(s) > h + 1);
      this.setSnap(next ?? (down ? "peek" : "full"));
    } else {
      // 慢慢拖：停到最近的一档
      this.setSnap(SNAPS.reduce((a, b) => (Math.abs(this.height(b) - h) < Math.abs(this.height(a) - h) ? b : a)));
    }
    this.drag = null;
    this.dragHeight = null;
    this.el.style.transition = "";
    this.el.style.height = "";
    this.measure();
  };

  /** 面板挡住的区域：桌面端在左侧，手机端在底部 */
  private measure() {
    if (this.drag) return; // 拖动中不跟着改地图留白，松手停稳后再量一次
    const r = this.el.getBoundingClientRect();
    const beside = r.width < innerWidth * 0.6;
    const next = beside
      ? { top: 0, right: 0, bottom: 0, left: Math.round(r.right) }
      : { top: 0, right: 0, bottom: Math.round(innerHeight - r.top), left: 0 };
    const key = `${next.left},${next.bottom}`;
    if (key === this.last) return;
    this.last = key;
    this.o.onPadding?.(next);
  }

  destroy() {
    this.observer.disconnect();
    this.handle.removeEventListener("pointerdown", this.down);
    this.handle.removeEventListener("pointermove", this.move);
    this.handle.removeEventListener("pointerup", this.up);
    this.handle.removeEventListener("pointercancel", this.up);
  }
}
