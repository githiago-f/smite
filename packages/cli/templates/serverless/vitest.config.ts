import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    ALLOW_GLOBAL_REGISTRY: "true",
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
