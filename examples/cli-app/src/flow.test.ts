import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileApps, defineSmiteConfig, dispatch } from "@smitejs/cli";
import { client } from "@smitejs/client";
import { clear } from "@smitejs/core";
import { openapi, swaggerUi } from "@smitejs/openapi";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "./app.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");

const alias = {
  "@smitejs/core": join(root, "packages/core/src/index.ts"),
  "@smitejs/fp": join(root, "packages/fp/src/index.ts"),
  "@smitejs/http": join(root, "packages/http/src/index.ts"),
  "@smitejs/cli": join(root, "packages/cli/src/index.ts"),
  "@smitejs/client": join(root, "packages/client/src/index.ts"),
  "@smitejs/openapi": join(root, "packages/openapi/src/index.ts"),
};

afterEach(() => clear());

describe("@smitejs/example-cli-app", () => {
  it("generates a typed client and an OpenAPI document from the config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-cli-app-"));
    const clientFile = join(dir, "app.client.ts");
    const openapiFile = join(dir, "openapi.json");

    const compiled = await compileApps({
      entries: [join(here, "app.mjs")],
      alias,
    });
    const config = defineSmiteConfig({
      entries: [join(here, "app.mjs")],
      plugins: [
        client({ outfile: clientFile }),
        openapi({ outfile: openapiFile, title: "Pets API" }),
      ],
    });

    await dispatch(config.plugins, "client", { apps: compiled });
    await dispatch(config.plugins, "openapi", { apps: compiled });

    const code = await readFile(clientFile, "utf8");
    expect(code).toContain("pets");
    expect(code).toContain('request("GET", "/pets/:id"');

    const doc = JSON.parse(await readFile(openapiFile, "utf8")) as {
      openapi: string;
      info: { title: string };
      paths: Record<string, unknown>;
    };
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("Pets API");
    expect(doc.paths["/pets/{id}"]).toBeDefined();
    await rm(dir, { recursive: true, force: true });
  });

  it("serves the OpenAPI document and a Swagger UI page", async () => {
    const doc = {
      openapi: "3.1.0",
      info: { title: "Pets API", version: "0.1.0" },
      paths: {
        "/pets/{id}": { get: { responses: { "200": { description: "OK" } } } },
      },
    };
    const docs = swaggerUi({ doc, title: "Pets API" });

    const spec = await docs({
      method: "GET",
      path: "/openapi.json",
      query: {},
      headers: {},
      cookies: {},
      params: {},
      body: undefined,
    });
    expect(spec.status).toBe(200);
    expect(spec.body).toEqual(doc);

    const page = await docs({
      method: "GET",
      path: "/docs",
      query: {},
      headers: {},
      cookies: {},
      params: {},
      body: undefined,
    });
    expect(page.status).toBe(200);
    expect(String(page.body)).toContain("swagger-ui");
    expect(String(page.body)).toContain("/openapi.json");
  });

  it("serves the app routes through its router", async () => {
    const router = app.serve();
    const response = await router({
      method: "GET",
      path: "/pets/42",
      query: {},
      headers: {},
      cookies: {},
      params: {},
      body: undefined,
    });
    expect(response).toEqual({ status: 200, body: { id: 42 } });
  });
});
