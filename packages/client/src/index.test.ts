import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "@smite/client";
import { clear } from "@smite/core";
import * as esbuild from "esbuild";
import { afterEach, describe, expect, it } from "vitest";

const cwd = process.cwd();

const entry = join(cwd, "packages/client/test/app.ts");

const sourceAliases = {
  "@smite/core": join(cwd, "packages/core/src/index.ts"),
  "@smite/http": join(cwd, "packages/http/src/index.ts"),
};

const clientAliases = {
  ...sourceAliases,
  "@smite/client/runtime": join(cwd, "packages/client/src/runtime.ts"),
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

describe("@smite/client", () => {
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

    const calls: Array<{ url: string; method?: string }> = [];
    mod.configure({
      baseUrl: "https://api.example.com",
      fetch: async (url: string, init: RequestInit) => {
        calls.push({ url, method: init.method });
        return new Response(JSON.stringify({ id: "42" }), { status: 200 });
      },
    });

    const response = await mod.api.users.$id.$get({ params: { id: "42" } });
    expect(calls[0]?.url).toBe("https://api.example.com/users/42");
    expect(calls[0]?.method).toBe("GET");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "42" });
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
});
