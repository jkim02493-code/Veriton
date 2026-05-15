import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.ts"),
        content: resolve(__dirname, "src/content/index.ts"),
        background: resolve(__dirname, "background.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
        format: "es",
      },
    },
    target: "es2020",
    minify: false,
  },
  resolve: {
    alias: {
      "@lib": resolve(__dirname, "../lib"),
    },
  },
});
