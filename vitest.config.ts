import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@smite/fp": resolve(import.meta.dirname, "packages/fp/src/index.ts"),
      "@smite/core": resolve(import.meta.dirname, "packages/core/src/index.ts"),
      "@smite/domain": resolve(
        import.meta.dirname,
        "packages/domain/src/index.ts",
      ),
      "@smite/http": resolve(import.meta.dirname, "packages/http/src/index.ts"),
      "@smite/env": resolve(import.meta.dirname, "packages/env/src/index.ts"),
      "@smite/client": resolve(
        import.meta.dirname,
        "packages/client/src/index.ts",
      ),
    },
  },
  define: {
    ALLOW_GLOBAL_REGISTRY: "true",
  },
  test: {
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
