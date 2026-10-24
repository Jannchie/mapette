// PWA 更新：注册 service worker，新版本装好后不自动接管，而是告诉页面「有新版本」，用户点刷新再切过去。
// 要配合 service worker 的写法：install 时不调 skipWaiting，收到 { type: "SKIP_WAITING" } 消息时再调；
// 而且每次部署 sw.js 的内容都要变（例如写进构建号），浏览器才会发现新版本。

export interface ServiceWorkerOptions {
  /** service worker 的地址，默认 /sw.js */
  url?: string;
  /** 新版本已下载好、在等待接管 */
  onNeedRefresh?: () => void;
  /** 第一次安装完成（之后可以离线打开） */
  onOfflineReady?: () => void;
  /** 定期检查更新的间隔（毫秒），默认一小时；页面切回前台时也会检查 */
  checkInterval?: number;
}

export interface ServiceWorkerUpdate {
  /** 切到新版本并重新加载页面 */
  apply(): void;
  /** 停止定期检查 */
  stop(): void;
}

export function registerServiceWorker(o: ServiceWorkerOptions = {}): ServiceWorkerUpdate {
  let waiting: ServiceWorker | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let onVisible: (() => void) | undefined;
  const update: ServiceWorkerUpdate = {
    apply() {
      if (!waiting) return location.reload();
      // 新 SW 接管（controllerchange）之后再重新加载，拿到的才是新资源
      navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
      waiting.postMessage({ type: "SKIP_WAITING" });
    },
    stop() {
      clearInterval(timer);
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
    },
  };
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return update;

  const found = (sw: ServiceWorker) => {
    waiting = sw;
    o.onNeedRefresh?.();
  };
  const track = (sw: ServiceWorker | null) => {
    sw?.addEventListener("statechange", () => {
      if (sw.state !== "installed") return;
      // 已经有旧版本在控制页面：新版本在等待；否则是第一次安装
      if (navigator.serviceWorker.controller) found(sw);
      else o.onOfflineReady?.();
    });
  };
  navigator.serviceWorker
    .register(o.url ?? "/sw.js", { scope: "/" })
    .then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) found(reg.waiting);
      track(reg.installing);
      reg.addEventListener("updatefound", () => track(reg.installing));
      // 长时间开着的页面：定期、以及切回前台时检查一次
      const check = () => void reg.update().catch(() => {});
      timer = setInterval(check, o.checkInterval ?? 60 * 60 * 1000);
      onVisible = () => document.visibilityState === "visible" && check();
      document.addEventListener("visibilitychange", onVisible);
    })
    .catch(() => {
      // 注册失败（隐私模式等）：不影响在线使用
    });
  return update;
}
