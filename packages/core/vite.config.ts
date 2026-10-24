import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" },
    rollupOptions: { external: [/^maplibre-gl/, "pmtiles", /^@floating-ui\//] },
    sourcemap: true,
    // 类型声明由 tsc 另外生成，CSS 原样复制，这里不清空 dist
    emptyOutDir: false,
  },
});
