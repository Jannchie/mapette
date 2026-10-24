// 当前是不是深色：看 <html> 上的手动选择（data-theme="light|dark" 或 class="dark"），都没有就跟随系统。
// meisho 不管主题怎么切换，只需要知道结果，地图据此重读配色。
import { onBeforeUnmount, onMounted, readonly, ref } from "vue";

export function useDarkMode() {
  const dark = ref(false);
  let media: MediaQueryList | null = null;
  let observer: MutationObserver | null = null;
  const update = () => {
    const root = document.documentElement;
    const theme = root.dataset.theme;
    dark.value = theme === "dark" || (theme !== "light" && (root.classList.contains("dark") || !!media?.matches));
  };
  onMounted(() => {
    media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    update();
  });
  onBeforeUnmount(() => {
    media?.removeEventListener("change", update);
    observer?.disconnect();
  });
  return readonly(dark);
}
