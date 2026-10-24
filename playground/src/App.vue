<script setup lang="ts">
// 小地图用法：照片详情侧栏里的「拍摄地点」卡片（Liora 那种），不需要面板、热力图和照片标记
import type { StyleContext } from "@mapette/core";
import { LocationMarker, MapControls, MapView } from "@mapette/vue";
import { ref } from "vue";

const places = [
  { name: "Yu Garden, Shanghai", lngLat: [121.48821, 31.22856] as [number, number] },
  { name: "Fushimi Inari-taisha, Kyoto", lngLat: [135.77268, 34.96714] as [number, number] },
];
const place = ref(places[0]);

const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;

// 用 Tailwind 那种 <html class="dark"> 切换，mapette 自动跟随
const dark = ref(false);
function toggleDark() {
  dark.value = !dark.value;
  document.documentElement.classList.toggle("dark", dark.value);
}

// 别家的底图也可以：按亮暗给样式 URL
const carto = ({ dark }: StyleContext) =>
  dark ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
</script>

<template>
  <main>
    <header>
      <h1>mapette playground</h1>
      <div class="actions">
        <button v-for="p in places" :key="p.name" :class="{ on: p === place }" @click="place = p">{{ p.name }}</button>
        <button @click="toggleDark">{{ dark ? "浅色" : "深色" }}</button>
      </div>
    </header>

    <div class="cards">
      <section class="card">
        <p class="caption">compact · mapette 底图</p>
        <p class="coords">{{ fmt(place.lngLat[1], "N", "S") }}, {{ fmt(place.lngLat[0], "E", "W") }}</p>
        <div class="mini">
          <MapView preset="compact" :center="place.lngLat" :zoom="14" locale="en">
            <LocationMarker :lng-lat="place.lngLat" pulse />
            <MapControls :locate="false" />
          </MapView>
        </div>
      </section>

      <section class="card">
        <p class="caption">static · 不能拖动、缩放</p>
        <p class="coords">{{ place.name }}</p>
        <div class="mini">
          <MapView preset="static" :center="place.lngLat" :zoom="12" locale="en">
            <LocationMarker :lng-lat="place.lngLat" />
          </MapView>
        </div>
      </section>

      <section class="card">
        <p class="caption">compact · CARTO 底图（随亮暗切换）</p>
        <p class="coords">{{ place.name }}</p>
        <div class="mini">
          <MapView preset="compact" :map-style="carto" :center="place.lngLat" :zoom="13">
            <LocationMarker :lng-lat="place.lngLat" pulse />
          </MapView>
        </div>
      </section>
    </div>
  </main>
</template>

<style>
html {
  color-scheme: light;
}
html.dark {
  color-scheme: dark;
}
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: var(--mapette-fg);
  background: var(--mapette-bg-solid);
}
main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 16px;
}
header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
h1 {
  font-size: 18px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.actions button {
  padding: 6px 12px;
  font: inherit;
  font-size: 13px;
  color: var(--mapette-fg);
  background: var(--mapette-hover);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}
.actions button.on {
  color: #fff;
  background: var(--mapette-accent);
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 16px;
}
.card {
  padding: 16px;
  border: 1px solid var(--mapette-line);
  border-radius: 12px;
}
.caption {
  margin: 0;
  font-size: 12px;
  color: var(--mapette-muted);
}
.coords {
  margin: 4px 0 12px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.mini {
  height: 200px;
  border-radius: 10px;
  overflow: hidden;
}
</style>
