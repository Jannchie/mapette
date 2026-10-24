// 当前是不是深色：以页面根元素实际生效的 color-scheme 为准——和底图配色（light-dark()）的求值方式一致。
// 页面只声明了 light 或 dark 时就是它；两者都允许（或没声明）时跟随系统。
// mapette.css 已经把 <html data-theme="dark"> 和 <html class="dark"> 映射成 color-scheme: dark。
// mapette 不管主题怎么切换，只需要知道结果，地图据此重读配色。

export function isDarkMode(): boolean {
  const scheme = getComputedStyle(document.documentElement).colorScheme;
  const dark = scheme.includes("dark");
  const light = scheme.includes("light");
  if (dark !== light) return dark;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

/** 亮暗变化时回调（立即回调一次），返回取消订阅的函数 */
export function watchDarkMode(callback: (dark: boolean) => void): () => void {
  let last: boolean | null = null;
  const update = () => {
    const dark = isDarkMode();
    if (dark !== last) callback((last = dark));
  };
  const media = matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", update);
  // 主题切换通常是改 <html> 的 class / data-theme / style，切换后样式表随之生效
  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
  update();
  return () => {
    media.removeEventListener("change", update);
    observer.disconnect();
  };
}
