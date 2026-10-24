import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// 两个入口：meisho/style 是纯 TS（不依赖 Vue），meisho/vue 是组件。类型声明由 vue-tsc 另外生成（见 tsconfig.build.json）
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: { style: resolve(import.meta.dirname, "src/style/index.ts"), vue: resolve(import.meta.dirname, "src/vue/index.ts") },
      formats: ["es"],
      cssFileName: "meisho",
    },
    rollupOptions: {
      // maplibre-gl 的样式表也由使用方的 maplibre-gl 提供；meisho 自己的 CSS 打包成 dist/meisho.css
      external: ["vue", /^maplibre-gl/, "pmtiles", /^@jannchie\//],
    },
    sourcemap: true,
  },
});
