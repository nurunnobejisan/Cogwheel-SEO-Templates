import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
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
    ],
  },
});
