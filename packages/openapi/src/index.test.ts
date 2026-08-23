import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileApp, compileApps, defineSmiteConfig } from "@smitejs/cli";
import { clear } from "@smitejs/core";
import { http } from "@smitejs/http";
import { afterEach, describe, expect, it } from "vitest";
import { openapi, swaggerUi, swaggerUiFromFile } from "./index.js";

const cwd = process.cwd();

const entry = join(cwd, "packages/openapi/test/app.ts");

const sourceAliases = {
  "@smitejs/core": join(cwd, "packages/core/src/index.ts"),
  "@smitejs/fp": join(cwd, "packages/fp/src/index.ts"),
  "@smitejs/http": join(cwd, "packages/http/src/index.ts"),
};

afterEach(() => clear());

describe("@smitejs/openapi", () => {
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

  it("emits root-level configuration passed to openapi()", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-openapi-"));
    const outfile = join(dir, "openapi.json");
    const app = await compileApp({ entry, alias: sourceAliases });

    // #section - Configure root-level OpenAPI options
    await openapi({
      outfile,
      title: "Fixture API",
      servers: [{ url: "https://api.example.com" }],
      security: [{ apiKey: [] }],
      securitySchemes: {
        apiKey: { type: "apiKey", in: "header", name: "X-Api-Key" },
      },
      tags: [{ name: "users", description: "User management" }],
      externalDocs: { url: "https://example.com/docs" },
      additional: { "x-custom": { enabled: true } },
    }).run({ apps: [app] });
    // #endsection

    const doc = JSON.parse(await readFile(outfile, "utf8")) as {
      servers: unknown[];
      security: unknown[];
      components: { securitySchemes: unknown };
      tags: unknown[];
      externalDocs: unknown;
      "x-custom": unknown;
    };
    expect(doc.servers).toEqual([{ url: "https://api.example.com" }]);
    expect(doc.security).toEqual([{ apiKey: [] }]);
    expect(doc.components.securitySchemes).toEqual({
      apiKey: { type: "apiKey", in: "header", name: "X-Api-Key" },
    });
    expect(doc.tags).toEqual([
      { name: "users", description: "User management" },
    ]);
    expect(doc.externalDocs).toEqual({ url: "https://example.com/docs" });
    expect(doc["x-custom"]).toEqual({ enabled: true });
    await rm(dir, { recursive: true, force: true });
  });

  it("emits route summary, description, and name tag into operations", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-openapi-"));
    const outfile = join(dir, "openapi.json");

    const app = http.app("docs-api");
    const page = http.router({
      name: "pages",
      summary: "Fetch pages",
      description: "Manage page resources.",
    });
    page.accept("GET", "/pages/:id").handler(() => ({ status: 200, body: {} }));
    app.use(page);

    await openapi({ outfile }).run({ apps: [app] });
    const doc = JSON.parse(await readFile(outfile, "utf8")) as Record<
      string,
      unknown
    >;
    const paths = doc.paths as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    const operation = paths["/pages/{id}"]?.get;
    expect(operation?.summary).toBe("Fetch pages");
    expect(operation?.description).toBe("Manage page resources.");
    expect(operation?.tags).toEqual(["pages"]);
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

  it("serves a document read from a file path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-openapi-"));
    const file = join(dir, "openapi.json");
    const doc = {
      openapi: "3.1.0",
      info: { title: "Pets API", version: "1.0.0" },
      paths: {},
    };
    await writeFile(file, JSON.stringify(doc), "utf8");
    // #section - Serve the OpenAPI document from a file
    const router = swaggerUiFromFile({ file, title: "Pets API" });
    const spec = await router({
      method: "GET",
      path: "/openapi.json",
      query: {},
      headers: {},
      cookies: {},
      params: {},
      body: undefined,
    });
    // #endsection

    expect(spec.status).toBe(200);
    expect(spec.body).toEqual(doc);
    const missing = await router({
      method: "GET",
      path: "/missing.json",
      query: {},
      headers: {},
      cookies: {},
      params: {},
      body: undefined,
    });
    expect(missing.status).toBe(404);
    await rm(dir, { recursive: true, force: true });
  });

  it("returns 404 from a file router when the document is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-openapi-"));
    const router = swaggerUiFromFile({ file: join(dir, "nope.json") });
    const spec = await router({
      method: "GET",
      path: "/openapi.json",
      query: {},
      headers: {},
      cookies: {},
      params: {},
      body: undefined,
    });
    expect(spec.status).toBe(404);
    await rm(dir, { recursive: true, force: true });
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
