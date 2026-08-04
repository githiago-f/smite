import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compileApp,
  compileApps,
  defineSmiteConfig,
  dispatch,
  entriesOf,
} from "@smitejs/cli";
import {
  client,
  collectEndpointsFromApps,
  emitClient,
  generate,
} from "@smitejs/client";
import { clear } from "@smitejs/core";
import * as esbuild from "esbuild";
import { afterEach, describe, expect, it } from "vitest";

const cwd = process.cwd();

const entry = join(cwd, "packages/client/test/app.ts");

const sourceAliases = {
  "@smitejs/core": join(cwd, "packages/core/src/index.ts"),
  "@smitejs/http": join(cwd, "packages/http/src/index.ts"),
};

const clientAliases = {
  ...sourceAliases,
  "@smitejs/client/runtime": join(cwd, "packages/client/src/runtime.ts"),
};

const buildClient = async (entryPath: string = entry) => {
  const dir = await mkdtemp(join(tmpdir(), "smite-client-"));
  const outfile = join(dir, "app.client.ts");
  await generate({ entry: entryPath, outfile, alias: sourceAliases });

  const bundled = join(dir, "app.client.cjs");
  await esbuild.build({
    entryPoints: [outfile],
    outfile: bundled,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "es2022",
    alias: clientAliases,
  });
  return import(bundled);
};

afterEach(() => clear());

describe("@smitejs/client", () => {
  it("emits a builder client from the app IR", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-client-"));
    const outfile = join(dir, "app.client.ts");
    const options = {
      entry: join(cwd, "packages/client/test/app.ts"),
      outfile,
      alias: sourceAliases,
    };
    // #section - Generate a typed client
    const code = await generate(options);
    // #endsection

    expect(code).toContain("users");
    expect(code).toContain("$id");
    expect(code).toContain('request("GET", "/users/:id"');
    expect(code).toContain('request("POST", "/users"');
    expect(code).toContain('request("GET", "/health"');
    expect(code).not.toContain("globalRegistry");
  });

  it("generated client executes against a stubbed fetch and mirrors the response", async () => {
    const mod = await buildClient();
    const { api, configure } = mod;

    const calls: Array<{ url: string; method?: string }> = [];
    // #section - Call the generated client
    configure({
      baseUrl: "https://api.example.com",
      fetch: async (url: string, init: RequestInit) => {
        calls.push({ url, method: init.method });
        return new Response(JSON.stringify({ id: "42" }), { status: 200 });
      },
    });

    const response = await api.users.$id.$get({ params: { id: "42" } });
    // #endsection
    expect(calls[0]?.url).toBe("https://api.example.com/users/42");
    expect(calls[0]?.method).toBe("GET");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "42" });
  });

  it("configures the client plugin in a Smite config", () => {
    // #section - Configure the client plugin
    const config = defineSmiteConfig({
      entries: ["./src/app.ts", "./src/handlers/events.ts"],
      plugins: [client({ outfile: "./src/app.client.ts" })],
    });
    // #endsection

    expect(config.entry).toBeUndefined();
    expect(entriesOf(config)).toEqual([
      "./src/app.ts",
      "./src/handlers/events.ts",
    ]);
    expect(config.plugins[0]?.name).toBe("client");
  });

  it("serializes query, body, and per-call config", async () => {
    const mod = await buildClient();

    const calls: Array<{
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }> = [];
    mod.configure({
      baseUrl: "https://api.example.com",
      fetch: async (url: string, init: RequestInit) => {
        calls.push({
          url,
          method: init.method,
          headers: init.headers as Record<string, string>,
          body: init.body as string,
        });
        return new Response(null, { status: 204 });
      },
    });

    const response = await mod.api.users.$post({
      query: { q: "a b", page: 1 },
      body: { name: "Ada" },
      headers: { authorization: "Bearer x" },
    });
    expect(calls[0]?.url).toBe("https://api.example.com/users?q=a+b&page=1");
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.body).toBe('{"name":"Ada"}');
    expect(calls[0]?.headers?.["content-type"]).toBe("application/json");
    expect(calls[0]?.headers?.authorization).toBe("Bearer x");
    expect(response.status).toBe(204);
    expect(response.body).toBe("");
  });

  it("prefers per-call $config over configure()", async () => {
    const mod = await buildClient();
    const calls: Array<{ url: string }> = [];
    mod.configure({
      baseUrl: "https://api.example.com",
      fetch: async (url: string) => {
        calls.push({ url });
        return new Response("ok", { status: 200 });
      },
    });

    const response = await mod.api.health.$get({
      $config: { baseUrl: "https://other.test" },
    });
    expect(calls[0]?.url).toBe("https://other.test/health");
    expect(response.body).toBe("ok");
  });

  it("does not throw on non-2xx and falls back to raw text bodies", async () => {
    const mod = await buildClient();
    mod.configure({
      fetch: async () => new Response("oops", { status: 404 }),
    });

    const response = await mod.api.health.$get();
    expect(response.status).toBe(404);
    expect(response.body).toBe("oops");
  });

  it("throws a descriptive error for a missing path param", async () => {
    const mod = await buildClient();
    mod.configure({
      fetch: async () => new Response("", { status: 200 }),
    });

    await expect(mod.api.users.$id.$get({ params: {} })).rejects.toThrow(
      /Missing param 'id'/,
    );
  });

  it("errors when no app is registered", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-client-"));
    const outfile = join(dir, "app.client.ts");
    await expect(
      generate({
        entry: join(cwd, "packages/client/test/empty.ts"),
        outfile,
        alias: sourceAliases,
      }),
    ).rejects.toThrow(/No app found/);
  });

  it("client() returns a CLI plugin that emits the same client", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-client-plugin-"));
    const outfile = join(dir, "app.client.ts");
    const plugin = client({ outfile });
    // #section - Register the client plugin
    const pluginApp = await compileApp({
      entry,
      alias: sourceAliases,
    });
    await plugin.run({ apps: [pluginApp] });
    // #endsection

    const code = await readFile(outfile, "utf8");
    expect(code).toContain("users");
    expect(code).not.toContain("globalRegistry");
    await rm(dir, { recursive: true, force: true });
  });

  it("creates a client through the CLI config + dispatch flow", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-client-cli-"));
    const outfile = join(dir, "app.client.ts");
    const config = defineSmiteConfig({
      entries: [entry],
      plugins: [client({ outfile })],
    });
    const apps = await compileApps({
      entries: entriesOf(config),
      alias: sourceAliases,
    });
    // #section - Create a client with the CLI
    await dispatch(config.plugins, "client", { apps });
    // #endsection

    const code = await readFile(outfile, "utf8");
    expect(code).toContain("users");
    expect(code).toContain('request("GET", "/users/:id"');
    await rm(dir, { recursive: true, force: true });
  });

  it("merges routes across multiple handler entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-client-entries-"));
    const apps = await compileApps({
      entries: [entry, join(cwd, "packages/cli/test/admin.ts")],
      alias: sourceAliases,
    });
    const code = emitClient(collectEndpointsFromApps(apps));
    expect(code).toContain("users");
    expect(code).toContain("admin");
    await rm(dir, { recursive: true, force: true });
  });
});
