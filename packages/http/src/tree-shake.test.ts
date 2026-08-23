import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { describe, expect, it } from "vitest";

const source = `
  import { http } from "@smitejs/http";

  const app = http.app();
  const route = http.router();
  route.accept("GET", "/ping").handler(() => ({ status: 200, body: "pong" }));
  app.use(route);
  export const router = app.serve();
`;

describe("runtime bundle", () => {
  it("drops the registry and still executes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "smite-"));
    const outfile = join(dir, "app.cjs");

    await esbuild.build({
      stdin: {
        contents: source,
        resolveDir: process.cwd(),
        sourcefile: "app.ts",
        loader: "ts",
      },
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "es2022",
      outfile,
      define: { ALLOW_GLOBAL_REGISTRY: "false" },
      alias: {
        "@smitejs/core": join(process.cwd(), "packages/core/src/index.ts"),
        "@smitejs/http": join(process.cwd(), "packages/http/src/index.ts"),
      },
    });

    const bundle = readFileSync(outfile, "utf8");

    expect(bundle).not.toContain("globalRegistry");

    const { router } = await import(outfile);
    const response = await router({
      method: "GET",
      path: "/ping",
      query: {},
      headers: {},
      params: {},
      body: undefined,
    });

    expect(response).toEqual({ status: 200, body: "pong" });
  });
});
