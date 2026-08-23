import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { describe, expect, it } from "vitest";

const appModule = `
  import { http } from "@smitejs/http";
  export const app = http.app("store");
`;

const itemsModule = `
  import { http } from "@smitejs/http";
  import { app } from "../app.ts";
  export const addItems = (unused: unknown): void => {
    const items = http.router({ name: "items" });
    items.accept("GET", "/items").handler(() => http.json({ marker: "ITEMS_MARKER_ONLY" }));
    app.use(items);
  };
`;

const cartsModule = `
  import { http } from "@smitejs/http";
  import { app } from "../app.ts";
  export const addCarts = (unused: unknown): void => {
    const carts = http.router({ name: "carts" });
    carts.accept("GET", "/cart").handler(() => http.json({ marker: "CARTS_MARKER_ONLY" }));
    app.use(carts);
  };
`;

const itemsHandler = `
  import { lambdaify } from "@smitejs/serverless/aws";
  import { app } from "./app.ts";
  import { addItems } from "./routers/items.ts";
  addItems(app);
  export const handler = lambdaify(app);
`;

const cartsHandler = `
  import { lambdaify } from "@smitejs/serverless/aws";
  import { app } from "./app.ts";
  import { addCarts } from "./routers/carts.ts";
  addCarts(app);
  export const handler = lambdaify(app);
`;

const bundleTo = async (entry: string, outfile: string, cwd: string) => {
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "es2022",
    absWorkingDir: cwd,
    define: { ALLOW_GLOBAL_REGISTRY: "false" },
    alias: {
      "@smitejs/core": join(cwd, "packages/core/src/index.ts"),
      "@smitejs/http": join(cwd, "packages/http/src/index.ts"),
      "@smitejs/serverless/aws": join(cwd, "packages/serverless/src/aws.ts"),
    },
  });
  return readFileSync(outfile, "utf8");
};

describe("@smitejs/serverless per-router bundles", () => {
  it("tree-shakes sibling routers out of each handler", async () => {
    const cwd = process.cwd();
    const cache = join(cwd, "node_modules", ".cache");
    mkdirSync(cache, { recursive: true });
    const dir = mkdtempSync(join(cache, "smite-ts-"));
    const src = join(dir, "src");
    mkdirSync(join(src, "routers"), { recursive: true });
    for (const [name, body] of [
      [join(src, "app.ts"), appModule],
      [join(src, "routers", "items.ts"), itemsModule],
      [join(src, "routers", "carts.ts"), cartsModule],
      [join(src, "items-handler.ts"), itemsHandler],
      [join(src, "carts-handler.ts"), cartsHandler],
    ]) {
      writeFileSync(name, body);
    }

    const [itemsBundle, cartsBundle] = await Promise.all([
      bundleTo(
        join(src, "items-handler.ts"),
        join(dir, "dist", "items.cjs"),
        cwd,
      ),
      bundleTo(
        join(src, "carts-handler.ts"),
        join(dir, "dist", "carts.cjs"),
        cwd,
      ),
    ]);

    expect(itemsBundle).not.toContain("CARTS_MARKER_ONLY");
    expect(itemsBundle).toContain("ITEMS_MARKER_ONLY");
    expect(cartsBundle).not.toContain("ITEMS_MARKER_ONLY");
    expect(cartsBundle).toContain("CARTS_MARKER_ONLY");

    const items = await import(join(dir, "dist", "items.cjs"));
    const hit = await items.handler({
      rawPath: "/items",
      requestContext: { http: { method: "GET" } },
    });
    expect(hit.statusCode).toBe(200);
    expect(JSON.parse(hit.body)).toEqual({ marker: "ITEMS_MARKER_ONLY" });

    const miss = await items.handler({
      rawPath: "/cart",
      requestContext: { http: { method: "GET" } },
    });
    expect(miss.statusCode).toBe(404);
  });
});
