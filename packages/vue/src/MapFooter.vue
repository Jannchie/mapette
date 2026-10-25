<script setup lang="ts">
// 面板底部（MapExplorer 的 #footer）：地图署名、数据来源、快捷键说明、外观切换、语言选择，各站点共用一套。
// OSM 要求地图署名始终可见：署名本身就是按钮，点开是全部来源、源代码与快捷键（原生 popover，点外部或 Esc 关闭）。
// 组件自己的文字按 locale 内置四种语言；换语言时触发 locale 事件，由站点决定怎么跳转（通常是 switchLocaleUrl）。
import { baseShortcuts, kitText, LOCALE_NAMES, LOCALES, type Locale } from "@mapette/core";
import { computed, ref, useId } from "vue";
import { useThemePref } from "./composables";

export interface FooterSource {
  label: string;
  href: string;
}

const props = withDefaults(defineProps<{
  locale: Locale;
  /** 数据来源（地图底图的几项不用写，组件自带） */
  sources?: FooterSource[];
  /** 源代码仓库 */
  repo?: string;
  /** 外观偏好存在 localStorage 的哪个键（与 themeInitScript 用同一个） */
  themeKey: string;
  /** 快捷键说明；不给就是 MapExplorer 内置的那几项 */
  shortcuts?: { keys: string[]; label: string }[];
  locales?: readonly Locale[];
  /** 署名按钮上的文字 */
  attribution?: string;
}>(), {
  sources: () => [],
  repo: undefined,
  shortcuts: undefined,
  locales: () => LOCALES,
  attribution: "© OpenStreetMap",
});

const emit = defineEmits<{ locale: [locale: Locale] }>();

const t = computed(() => kitText(props.locale));
const { pref, cycle } = useThemePref(props.themeKey);
const themeLabel = computed(() => ({ auto: t.value.themeAuto, light: t.value.themeLight, dark: t.value.themeDark })[pref.value]);
const shortcutList = computed(() => props.shortcuts ?? baseShortcuts(props.locale));

/** 地图本身的来源：底图、矢量瓦片、地形 */
const BASEMAP: FooterSource[] = [
  { label: "© OpenStreetMap", href: "https://www.openstreetmap.org/copyright" },
  { label: "© OpenMapTiles", href: "https://openmaptiles.org/" },
  { label: "OpenFreeMap", href: "https://openfreemap.org/" },
  { label: "Terrain Tiles", href: "https://registry.opendata.aws/terrain-tiles/" },
];

// 同一页面可能有多个页脚（少见），popover 的 id 要唯一
const uid = useId();
const creditsId = `mapette-credits-${uid}`;
const shortcutsId = `mapette-shortcuts-${uid}`;
const creditsBtn = ref<HTMLElement>();
const creditsPop = ref<HTMLElement>();
const shortcutsPop = ref<HTMLElement>();

/** 打开时贴着署名按钮的上方（不依赖 CSS 锚点定位，旧浏览器也一样） */
function onCreditsToggle(e: Event) {
  if ((e as ToggleEvent).newState !== "open") return;
  const r = creditsBtn.value!.getBoundingClientRect();
  Object.assign(creditsPop.value!.style, { left: `${r.left - 4}px`, bottom: `${innerHeight - r.top + 8}px` });
}

defineExpose({
  /** 打开或关闭快捷键说明（站点的 ? 快捷键用） */
  toggleShortcuts: () => shortcutsPop.value?.togglePopover(),
  /** 快捷键说明是否开着（Esc 交给 popover 自己关） */
  shortcutsOpen: () => !!shortcutsPop.value?.matches(":popover-open"),
});
</script>

<template>
  <div class="mapette-foot">
    <button ref="creditsBtn" type="button" class="mapette-credits-btn" :popovertarget="creditsId" :title="t.credits">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
      <span>{{ attribution }}</span>
    </button>
    <div :id="creditsId" ref="creditsPop" popover class="mapette-credits-pop" @toggle="onCreditsToggle">
      <a v-for="s in sources" :key="s.href" :href="s.href" target="_blank" rel="noopener">{{ s.label }}</a>
      <a v-for="s in BASEMAP" :key="s.href" :href="s.href" target="_blank" rel="noopener">{{ s.label }}</a>
      <hr />
      <a v-if="repo" class="mapette-credits-row" :href="repo" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>
        <span>{{ t.source }}</span>
      </a>
      <!-- 站点自己的项（例如 junrei 的成人向开关） -->
      <slot name="credits" />
      <button type="button" class="mapette-credits-row mapette-kb-btn" :popovertarget="shortcutsId">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></svg>
        <span>{{ t.shortcuts }}</span>
      </button>
    </div>
    <div :id="shortcutsId" ref="shortcutsPop" popover class="mapette-shortcuts-pop">
      <h3>{{ t.shortcuts }}</h3>
      <dl>
        <template v-for="s in shortcutList" :key="s.label">
          <dt><kbd v-for="k in s.keys" :key="k">{{ k }}</kbd></dt>
          <dd>{{ s.label }}</dd>
        </template>
      </dl>
    </div>
    <button type="button" class="mapette-foot-btn" :title="themeLabel" :aria-label="themeLabel" @click="cycle">
      <!-- 图形取自 @jannchie/icons（sun / moon / theme），与站点其余图标同一套 -->
      <svg v-if="pref === 'light'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 12a4 4 0 108 0A4 4 0 108 12m10.5 0H21m-4.4 4.6l1.76 1.76M12 18.5V21M7.4 16.6L5.64 18.36M5.5 12H3M7.4 7.4L5.64 5.64M12 5.5V3m4.6 4.4l1.76-1.76" /></svg>
      <svg v-else-if="pref === 'dark'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.21 14.72A8.5 8.5 0 119.78 4.29q1.58-.27.76 1.11a6.5 6.5 0 008.56 8.56q1.38-.82 1.11.76z" /></svg>
      <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 7.5a2 2 0 104 0 2 2 0 10-4 0m6 0h1.25m-5.25 4v1.25M4.67 10.33l-.88.88M3.5 7.5H2.25M4.67 4.67l-.88-.88M7.5 3.5V2.25m2.83 2.42l.88-.88M19 5L5 19m15.74-1.93a4.25 4.25 0 11-4.56-4.56 3.25 3.25 0 004.56 4.56z" /></svg>
    </button>
    <label class="mapette-lang" :title="t.language">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h8M8 3v2M10 5c-1 4-3 7-6 9M6 9c1 2 3 4 5 5M13 21l4-9 4 9M14.5 18h5" /></svg>
      <select :value="locale" :aria-label="t.language" @change="emit('locale', ($event.target as HTMLSelectElement).value as Locale)">
        <option v-for="l in locales" :key="l" :value="l">{{ LOCALE_NAMES[l] }}</option>
      </select>
    </label>
  </div>
</template>
