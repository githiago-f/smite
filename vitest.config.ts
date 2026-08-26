import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@smitejs/fp": resolve(import.meta.dirname, "packages/fp/src/index.ts"),
      "@smitejs/core": resolve(
        import.meta.dirname,
        "packages/core/src/index.ts",
      ),
      "@smitejs/handlers": resolve(
        import.meta.dirname,
        "packages/handlers/src/index.ts",
      ),
      "@smitejs/jobs": resolve(
        import.meta.dirname,
        "packages/jobs/src/index.ts",
      ),
      "@smitejs/messaging": resolve(
        import.meta.dirname,
        "packages/messaging/src/index.ts",
      ),
      "@smitejs/realtime": resolve(
        import.meta.dirname,
        "packages/realtime/src/index.ts",
      ),
      "@smitejs/domain": resolve(
        import.meta.dirname,
        "packages/domain/src/index.ts",
      ),
      "@smitejs/aws": resolve(import.meta.dirname, "packages/aws/src/index.ts"),
      "@smitejs/http": resolve(
        import.meta.dirname,
        "packages/http/src/index.ts",
      ),
      "@smitejs/env": resolve(import.meta.dirname, "packages/env/src/index.ts"),
      "@smitejs/serverless": resolve(
        import.meta.dirname,
        "packages/serverless/src/index.ts",
      ),
      "@smitejs/serverless/aws": resolve(
        import.meta.dirname,
        "packages/serverless/src/aws.ts",
      ),
      "@smitejs/client": resolve(
        import.meta.dirname,
        "packages/client/src/index.ts",
      ),
      "@smitejs/cli": resolve(import.meta.dirname, "packages/cli/src/index.ts"),
      "@smitejs/openapi": resolve(
        import.meta.dirname,
        "packages/openapi/src/index.ts",
      ),
      "@smitejs/logs": resolve(
        import.meta.dirname,
        "packages/logs/src/index.ts",
      ),
      "@smitejs/snippets": resolve(
        import.meta.dirname,
        "packages/snippets/src/index.ts",
      ),
    },
  },
  define: {
    ALLOW_GLOBAL_REGISTRY: "true",
  },
  test: {
    exclude: [
      "**/dist/**",
      "**/node_modules/**",
      "**/templates/**",
      "**/templates-built/**",
    ],
    globalSetup: resolve(import.meta.dirname, "vitest.global-setup.ts"),
  },
});
