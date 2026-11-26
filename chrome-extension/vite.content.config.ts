import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * Separate build for the MV3 content script.
 *
 * Chrome registers content scripts as *classic* scripts, so the bundle must be
 * a single self-contained IIFE — no `import` statements, no code splitting.
 * (The main Vite build handles the HTML pages and the module service worker.)
 */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/content/index.ts"),
      name: "SeoStudioContent",
      formats: ["iife"],
      fileName: () => "content.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        extend: false,
      },
    },
  },
});