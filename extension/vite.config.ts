import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const buildTarget = process.env.BUILD_TARGET ?? "content";
const isContentBuild = buildTarget === "content";

export default defineConfig({
    mode: 'production',
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process': JSON.stringify({ env: { NODE_ENV: 'production' } }),
      'process.env.SUPABASE_URL': JSON.stringify(
        'https://tgvrjlkksdzrtjmqmthw.supabase.co'
      ),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(
        'sb_publishable_g47iQek89ST9UEmpIm0KMw_pOzZTJWr'
      ),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(
        'https://tgvrjlkksdzrtjmqmthw.supabase.co'
      ),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        'sb_publishable_g47iQek89ST9UEmpIm0KMw_pOzZTJWr'
      ),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        'https://tgvrjlkksdzrtjmqmthw.supabase.co'
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        'sb_publishable_g47iQek89ST9UEmpIm0KMw_pOzZTJWr'
      ),
    },
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
