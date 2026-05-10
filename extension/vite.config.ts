import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const buildTarget = process.env.BUILD_TARGET ?? "content";
const isContentBuild = buildTarget === "content";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: isContentBuild,
    lib: isContentBuild
      ? {
          entry: resolve(__dirname, "src/content/index.tsx"),
          name: "AcademicCitationCopilotContent",
          formats: ["iife"],
          fileName: () => "assets/content.js",
        }
      : {
          entry: resolve(__dirname, "src/background/serviceWorker.ts"),
          formats: ["es"],
          fileName: () => "assets/background.js",
        },
    rollupOptions: {
      output: {
        format: isContentBuild ? "iife" : "es",
        inlineDynamicImports: true,
        entryFileNames: isContentBuild ? "assets/content.js" : "assets/background.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
