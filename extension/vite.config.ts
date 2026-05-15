import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        content: resolve(__dirname, "src/content/index.ts"),
        background: resolve(__dirname, "background.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "[name].[ext]",
        format: "es",
      },
    },
    target: "es2020",
    minify: false,
    modulePreload: false,
  },
  resolve: {
    alias: {
      "@lib": resolve(__dirname, "../lib"),
    },
  },
});
