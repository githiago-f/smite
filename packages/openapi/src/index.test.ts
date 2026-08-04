import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileApp, compileApps, defineSmiteConfig } from "@smite/cli";
import { clear } from "@smite/core";
import { afterEach, describe, expect, it } from "vitest";
import { openapi, swaggerUi } from "./index.js";

const cwd = process.cwd();

const entry = join(cwd, "packages/openapi/test/app.ts");

const sourceAliases = {
  "@smite/core": join(cwd, "packages/core/src/index.ts"),
  "@smite/fp": join(cwd, "packages/fp/src/index.ts"),
  "@smite/http": join(cwd, "packages/http/src/index.ts"),
};

afterEach(() => clear());

describe("@smite/openapi", () => {
  it("emits an OpenAPI 3.1 document for a multi-route app", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-openapi-"));
    const outfile = join(dir, "openapi.json");
    const app = await compileApp({ entry, alias: sourceAliases });

    // #section - Generate an OpenAPI document
    await openapi({ outfile, title: "Fixture API" }).run({ apps: [app] });
    // #endsection

    const doc = JSON.parse(await readFile(outfile, "utf8")) as {
      openapi: string;
      info: { title: string };
      paths: Record<
        string,
        Record<
          string,
          {
            parameters?: Array<{
              name: string;
              in: string;
              required: boolean;
            }>;
            requestBody?: {
              content: { "application/json": { schema: unknown } };
            };
          }
        >
      >;
    };

    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("Fixture API");
    expect(doc.paths["/users/{id}"]).toBeDefined();
    expect(doc.paths["/users/{id}"]?.get).toBeDefined();
    expect(doc.paths["/users/{id}"]?.post).toBeDefined();

    const getParams = doc.paths["/users/{id}"]?.get.parameters ?? [];
    expect(getParams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "id", in: "path", required: true }),
        expect.objectContaining({ name: "q", in: "query", required: false }),
      ]),
    );

    expect(doc.paths["/users/{id}"]?.post.requestBody).toBeDefined();
    expect(
      doc.paths["/users/{id}"]?.post.requestBody?.content["application/json"]
        .schema,
    ).toBeDefined();

    expect(doc.paths["/anything"]).toBeUndefined();
    expect(doc.paths["/health"]).toBeDefined();
    await rm(dir, { recursive: true, force: true });
  });

  it("emits an empty paths object for an app with no routes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-openapi-"));
    const outfile = join(dir, "openapi.json");
    const app = await compileApp({
      entry: join(cwd, "packages/openapi/test/empty-app.ts"),
      alias: sourceAliases,
    });

    await openapi({ outfile }).run({ apps: [app] });
    const doc = JSON.parse(await readFile(outfile, "utf8")) as {
      paths: Record<string, unknown>;
    };
    expect(doc.paths).toEqual({});
    await rm(dir, { recursive: true, force: true });
  });

  it("serves the document and a Swagger UI page from a router", async () => {
    const doc = {
      openapi: "3.1.0",
      info: { title: "Pets API", version: "1.0.0" },
      paths: {},
    };
    // #section - Serve the OpenAPI document
    const router = swaggerUi({ doc, title: "Pets API" });
    const spec = await router({
      method: "GET",
      path: "/openapi.json",
      query: {},
      headers: {},
      cookies: {},
      params: {},
      body: undefined,
    });
    const page = await router({
      method: "GET",
      path: "/docs",
      query: {},
      headers: {},
      cookies: {},
      params: {},
      body: undefined,
    });
    // #endsection

    expect(spec.status).toBe(200);
    expect(spec.body).toEqual(doc);
    expect(spec.headers?.["content-type"]).toContain("application/json");
    expect(page.status).toBe(200);
    expect(page.headers?.["content-type"]).toContain("text/html");
    expect(page.body).toContain("swagger-ui");
    expect(page.body).toContain("/openapi.json");

    const missing = await router({
      method: "GET",
      path: "/nope",
      query: {},
      headers: {},
      cookies: {},
      params: {},
      body: undefined,
    });
    expect(missing.status).toBe(404);
  });

  it("configures the openapi plugin in a Smite config", () => {
    // #section - Configure the openapi plugin
    const config = defineSmiteConfig({
      entries: ["./src/app.ts"],
      plugins: [openapi({ outfile: "./openapi.json", title: "My API" })],
    });
    // #endsection

    expect(config.entry).toBeUndefined();
    expect(config.plugins[0]?.name).toBe("openapi");
  });

  it("composes the swagger router next to an app's serve router", async () => {
    const compiled = await compileApp({ entry, alias: sourceAliases });
    const doc = {
      openapi: "3.1.0",
      info: { title: "Pets API", version: "1.0.0" },
      paths: {
        "/pets/{id}": { get: { responses: { "200": { description: "OK" } } } },
      },
    };
    // #section - Compose Swagger UI with the app router
    const router = compiled.serve();
    const docs = swaggerUi({ doc, title: "Pets API" });
    const serve = async (request) => {
      const response = await docs(request);
      return response.status === 404 ? router(request) : response;
    };
    // #endsection

    const appResponse = await router({
      method: "POST",
      path: "/users/42",
      query: {},
      headers: {},
      cookies: {},
      params: { id: "42" },
      body: { name: "Rex" },
    });
    expect(appResponse.status).toBe(201);

    const docsPage = await serve({
      method: "GET",
      path: "/docs",
      query: {},
      headers: {},
      cookies: {},
      params: {},
      body: undefined,
    });
    expect(docsPage.status).toBe(200);
    expect(String(docsPage.body)).toContain("swagger-ui");
  });

  it("merges paths across multiple handler entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-openapi-"));
    const outfile = join(dir, "openapi.json");
    const apps = await compileApps({
      entries: [entry, join(cwd, "packages/openapi/test/admin.ts")],
      alias: sourceAliases,
    });

    await openapi({ outfile }).run({ apps });
    const doc = JSON.parse(await readFile(outfile, "utf8")) as {
      paths: Record<string, unknown>;
    };
    expect(doc.paths["/users/{id}"]).toBeDefined();
    expect(doc.paths["/admin/stats"]).toBeDefined();
    await rm(dir, { recursive: true, force: true });
  });
});
