import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Components under src/ use the automatic JSX runtime (Next/SWC style);
  // esbuild's default is classic, which breaks renderToStaticMarkup tests.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/tasks/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "tests/ts/**",
      "tests/schemas.test.ts",
      "tests/internalLinker.test.ts",
      "tests/securityGuardrails.test.ts",
      "tests/variableResolver.test.ts",
      "tests/exporters.test.ts",
      "tests/uniquenessGate.test.ts",
      "tests/serpOptimizer.test.ts",
      "tests/heading-structure-audit.test.ts",
      "tests/image-optimization-audit.test.ts",
      "tests/unified-seo-platform.test.ts",
      "tests/hotel-seo.test.ts",
    ],
  },
});
