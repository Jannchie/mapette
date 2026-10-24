<script setup lang="ts">
// PWA 更新提示：注册 service worker，新版本下载好后在页面顶部弹一条「有新版本可用 · 刷新」，点刷新切到新版本。
// service worker 要配合（见 @mapette/core 的 registerServiceWorker）：等 SKIP_WAITING 消息再接管，每次部署内容都要变。
// 开发环境别注册（站点传 :register="import.meta.env.PROD"），否则开发服务器的页面会被缓存住。
import { kitText, registerServiceWorker, type Locale, type ServiceWorkerUpdate } from "@mapette/core";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = withDefaults(defineProps<{
  locale: Locale;
  /** service worker 的地址 */
  url?: string;
  /** 是否注册 service worker */
  register?: boolean;
}>(), { url: "/sw.js", register: true });

const t = computed(() => kitText(props.locale));
const needRefresh = ref(false);
let sw: ServiceWorkerUpdate | null = null;

onMounted(() => {
  if (!props.register) return;
  sw = registerServiceWorker({ url: props.url, onNeedRefresh: () => (needRefresh.value = true) });
});
onBeforeUnmount(() => sw?.stop());

/** 站点自己的界面也可以调（例如「关于」页里的「检查更新」）；没在等待的新版本时就是重新加载 */
const reload = () => (sw ? sw.apply() : location.reload());
defineExpose({ needRefresh, reload });
</script>

<template>
  <Transition name="mapette-toast">
    <div v-if="needRefresh" class="mapette-toast" role="status" aria-live="polite">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="mapette-toast-icon" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>
      <span class="mapette-toast-msg">{{ t.updateReady }}</span>
      <button type="button" class="mapette-toast-primary" @click="reload">{{ t.reload }}</button>
      <button type="button" class="mapette-toast-close" :title="t.later" :aria-label="t.later" @click="needRefresh = false">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  </Transition>
</template>
