// 浮在地图上的面板：桌面端停在左侧，手机端（≤ 640px，CSS 决定）是底部抽屉，吸附到收起 / 半屏 / 全屏三档。
// 抽屉整体（把手、搜索栏、内容）是一个面：没占满屏幕时在哪里上下拖都是拖整个抽屉，占满屏幕后内容才自己滚动。
// 面板挡住的区域通过 onPadding 报出去，交给地图控制器的 setPadding，让地图的可视中心避开它。
import type { PaddingOptions } from "maplibre-gl";

export type SheetSnap = "peek" | "half" | "full";

export interface SheetOptions {
  /** 收起时露出的高度（px） */
  peekHeight?: number;
  /** 半屏占可用高度（面板所在容器的高度）的比例 */
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
 * 高度按面板所在的容器（定位父元素）算，不用 vh / dvh：iOS 主屏 PWA 里视口单位和实际可用的高度对不上
 * （状态栏算进去了），按视口单位算的面板会超出屏幕。
 */
export class Sheet {
  private snap: SheetSnap;
  private o: Required<Omit<SheetOptions, "onSnap" | "onPadding" | "snap">> & SheetOptions;
  /**
   * 进行中的手势。mode：pending 还没判断方向；sheet 拖整个面板；native 交给浏览器（滚动内容、横向滑动、选文字）
   */
  private g: {
    x: number; y: number; height: number; lastY: number; lastT: number; v: number;
    onHandle: boolean; target: Element; mode: "pending" | "sheet" | "native";
  } | null = null;
  // 拖动中的高度直接写到面板的 style 上，不经过框架的响应式：每帧重渲染整个面板太重
  private dragHeight: number | null = null;
  private observer: ResizeObserver;
  private last = "";
  /** 底部抽屉的宽度（与 mapette.css 的断点一致）；桌面侧栏不能拖 */
  private phone = matchMedia("(max-width: 640px)");

  constructor(private el: HTMLElement, private handle: HTMLElement, options: SheetOptions = {}) {
    this.o = { peekHeight: 84, halfRatio: 0.46, fullGap: 48, ...options };
    this.snap = options.snap ?? "half";
    el.classList.add("mapette-sheet");
    el.style.setProperty("--peek", `${this.o.peekHeight}px`);
    el.style.setProperty("--half", `${this.o.halfRatio * 100}%`);
    el.style.setProperty("--full-gap", `${this.o.fullGap}px`);
    this.applySnap();
    // 整个面板都能拖（不只是把手）：触摸用 touch 事件，才能在 touchmove 里拦下浏览器自己的滚动；鼠标用 pointer 事件
    el.addEventListener("touchstart", this.touchStart, { passive: true });
    el.addEventListener("touchmove", this.touchMove, { passive: false });
    el.addEventListener("touchend", this.end);
    el.addEventListener("touchcancel", this.end);
    el.addEventListener("pointerdown", this.mouseDown);
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

  /** 面板所在容器的范围（MapExplorer 里是铺满屏幕的 .mapette-explorer），没有定位父元素时是视口 */
  private box() {
    const p = this.el.offsetParent;
    return p ? p.getBoundingClientRect() : { top: 0, bottom: innerHeight, height: innerHeight };
  }

  /** 各档高度（px），和 CSS 里 .mapette-sheet-* 的高度对应 */
  private height(s: SheetSnap) {
    const h = this.box().height;
    return s === "peek" ? this.o.peekHeight : s === "half" ? h * this.o.halfRatio : h - this.o.fullGap;
  }

  private start(x: number, y: number, t: number, target: Element) {
    if (!this.phone.matches) return;
    this.g = {
      x, y, lastY: y, lastT: t, v: 0, height: this.el.getBoundingClientRect().height,
      onHandle: this.handle.contains(target), target, mode: "pending",
    };
  }

  /** 返回 true 表示这一下归面板，调用方要拦下浏览器的默认行为 */
  private move(x: number, y: number, t: number): boolean {
    const g = this.g;
    if (!g || g.mode === "native") return false;
    if (t > g.lastT) g.v = (y - g.lastY) / (t - g.lastT); // px/ms，向下为正
    g.lastY = y;
    g.lastT = t;
    const dx = x - g.x, dy = y - g.y;
    if (g.mode === "pending") {
      // 位移很小时仍算轻点；这期间不是全屏就先拦着，免得浏览器抢先滚动内容
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return g.onHandle || this.snap !== "full";
      g.mode = this.claims(g, dx, dy) ? "sheet" : "native";
      if (g.mode === "native") return false;
      this.el.classList.add("mapette-sheet-dragging");
      getSelection()?.removeAllRanges();
    }
    this.dragHeight = Math.min(this.height("full"), Math.max(72, g.height - dy));
    this.el.style.transition = "none";
    this.el.style.height = `${this.dragHeight}px`;
    return true;
  }

  /**
   * 这次滑动归谁：横向的留给内容（横向滚动的列表）；纵向的，没占满屏幕时一律拖整个面板，
   * 占满屏幕时内容正常滚动，只有内容已经在顶部、又往下拉，才把面板拉下来
   */
  private claims(g: NonNullable<Sheet["g"]>, dx: number, dy: number) {
    if (g.onHandle) return true;
    if (Math.abs(dx) > Math.abs(dy)) return false;
    if (this.snap !== "full") return true;
    return dy > 0 && !this.scrolled(g.target);
  }

  /** 手指下的内容是否已经往下滚过（从它往上找到面板为止的第一个可滚动元素） */
  private scrolled(target: Element) {
    for (let e: Element | null = target; e && e !== this.el; e = e.parentElement) {
      const oy = getComputedStyle(e).overflowY;
      if ((oy === "auto" || oy === "scroll") && e.scrollHeight > e.clientHeight) return e.scrollTop > 0;
    }
    return false;
  }

  private end = () => {
    const g = this.g;
    const h = this.dragHeight;
    this.g = null;
    if (!g) return;
    if (g.mode === "sheet" && h != null) {
      if (Math.abs(g.v) > 0.4) {
        // 快速甩动：顺着方向切到下一档
        const down = g.v > 0;
        const next = down ? [...SNAPS].reverse().find((s) => this.height(s) < h - 1) : SNAPS.find((s) => this.height(s) > h + 1);
        this.setSnap(next ?? (down ? "peek" : "full"));
      } else {
        // 慢慢拖：停到最近的一档
        this.setSnap(SNAPS.reduce((a, b) => (Math.abs(this.height(b) - h) < Math.abs(this.height(a) - h) ? b : a)));
      }
      this.swallowClick();
    } else if (g.mode === "pending" && g.onHandle) {
      // 轻点把手：半屏 → 收起，其余 → 半屏
      this.setSnap(this.snap === "half" ? "peek" : "half");
    }
    this.dragHeight = null;
    this.el.classList.remove("mapette-sheet-dragging");
    this.el.style.transition = "";
    this.el.style.height = "";
    this.measure();
  };

  /** 拖完松手时手指下面的链接、按钮不算被点了一下 */
  private swallowClick() {
    const stop = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };
    addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => removeEventListener("click", stop, { capture: true }), 300);
  }

  private touchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return void (this.g && this.end());
    const p = e.touches[0];
    this.start(p.clientX, p.clientY, e.timeStamp, e.target as Element);
  };

  private touchMove = (e: TouchEvent) => {
    const p = e.touches[0];
    if (p && this.move(p.clientX, p.clientY, e.timeStamp) && e.cancelable) e.preventDefault();
  };

  private mouseDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    this.start(e.clientX, e.clientY, e.timeStamp, e.target as Element);
    if (!this.g) return;
    const move = (m: PointerEvent) => {
      if (this.move(m.clientX, m.clientY, m.timeStamp)) m.preventDefault();
    };
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      this.end();
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  };

  /** 面板挡住的区域：桌面端在左侧，手机端在底部 */
  private measure() {
    if (this.dragHeight != null) return; // 拖动中不跟着改地图留白，松手停稳后再量一次
    const r = this.el.getBoundingClientRect();
    const beside = r.width < innerWidth * 0.6;
    const next = beside
      ? { top: 0, right: 0, bottom: 0, left: Math.round(r.right) }
      : { top: 0, right: 0, bottom: Math.round(this.box().bottom - r.top), left: 0 };
    const key = `${next.left},${next.bottom}`;
    if (key === this.last) return;
    this.last = key;
    this.o.onPadding?.(next);
  }

  destroy() {
    this.observer.disconnect();
    this.el.removeEventListener("touchstart", this.touchStart);
    this.el.removeEventListener("touchmove", this.touchMove);
    this.el.removeEventListener("touchend", this.end);
    this.el.removeEventListener("touchcancel", this.end);
    this.el.removeEventListener("pointerdown", this.mouseDown);
  }
}
