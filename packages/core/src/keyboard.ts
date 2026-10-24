// 全局键盘快捷键：在输入框、下拉框里打字时不触发（Esc、上下方向键与 Ctrl/⌘ 组合键除外），输入法组字时一律不触发
export type KeyHandler = (e: KeyboardEvent) => boolean | void;

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** 按键名：e.key（字母小写，如 "/"、"j"、"Escape"），带 Ctrl/⌘ 时是 "mod+k" */
export function keyName(e: KeyboardEvent): string {
  const mod = e.ctrlKey || e.metaKey;
  return mod ? `mod+${e.key.toLowerCase()}` : e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

/** keys：按键名 → 处理函数；处理函数返回 false 表示不拦截，交还浏览器。返回取消函数 */
export function onShortcuts(keys: Record<string, KeyHandler> | (() => Record<string, KeyHandler>)) {
  const listener = (e: KeyboardEvent) => {
    if (e.isComposing || e.altKey) return;
    const map = typeof keys === "function" ? keys() : keys;
    const handler = map[keyName(e)];
    const mod = e.ctrlKey || e.metaKey;
    if (!handler || (typing(e.target) && !mod && !/^(Escape|ArrowDown|ArrowUp)$/.test(e.key))) return;
    if (handler(e) !== false) e.preventDefault();
  };
  addEventListener("keydown", listener);
  return () => removeEventListener("keydown", listener);
}
