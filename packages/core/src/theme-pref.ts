// 外观偏好：跟随系统 / 浅色 / 深色。配色用 light-dark() 定义，这里只切 <html data-theme>（mapette.css 映射成 color-scheme）。
// 选择存在 localStorage；首次绘制前用 themeInitScript 先应用，避免刷新时闪一下。

export type ThemePref = "auto" | "light" | "dark";
export const THEME_PREFS: ThemePref[] = ["auto", "light", "dark"];

/** 放进 <head> 的内联脚本：首次绘制前应用保存的选择 */
export const themeInitScript = (storageKey: string) =>
  `try{var t=localStorage.getItem(${JSON.stringify(storageKey)});if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export function readThemePref(storageKey: string): ThemePref {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark" || saved === "auto") return saved;
  } catch {}
  return "auto";
}

/** 应用到页面：切换瞬间完成（临时关掉所有 CSS 过渡），不保存 */
export function applyThemePref(pref: ThemePref) {
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);
  if (pref === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = pref;
  getComputedStyle(document.documentElement).color; // 强制按新配色算一次样式，再撤掉禁用
  requestAnimationFrame(() => style.remove());
}

export function saveThemePref(storageKey: string, pref: ThemePref) {
  try {
    localStorage.setItem(storageKey, pref);
  } catch {}
}

export const nextThemePref = (pref: ThemePref): ThemePref => THEME_PREFS[(THEME_PREFS.indexOf(pref) + 1) % THEME_PREFS.length];
