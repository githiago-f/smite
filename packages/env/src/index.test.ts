import { clear, lookupAll } from "@smitejs/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { env } from "./index.js";

afterEach(() => clear());

const from =
  (values: Record<string, unknown>) =>
  async (key: string): Promise<unknown> =>
    values[key];

describe("@smitejs/env", () => {
  it("resolves and parses a typed value through the provider", async () => {
    const instance = env
      .register({
        databaseUrl: { key: "DATABASE_URL", validation: z.string() },
      })
      .withProvider(from({ DATABASE_URL: "postgres://x" }));
    await expect(instance.databaseUrl).resolves.toBe("postgres://x");
  });

  it("resolves through the provider once and caches per instance", async () => {
    let calls = 0;
    const instance = env
      .register({ token: { key: "TOKEN", validation: z.string() } })
      .withProvider(async (key) => {
        calls += 1;
        return { TOKEN: "t1" }[key];
      });
    await instance.token;
    await instance.token;
    expect(calls).toBe(1);
  });

  it("isolates instances - each has its own provider and cache", async () => {
    const build = (value: unknown) =>
      env
        .register({ port: { key: "PORT", validation: z.coerce.number() } })
        .withProvider(async () => value);
    const a = build("3000");
    const b = build("4000");
    await expect(a.port).resolves.toBe(3000);
    await expect(b.port).resolves.toBe(4000);
  });

  it("supports async providers", async () => {
    const instance = env
      .register({ port: { key: "PORT", validation: z.coerce.number() } })
      .withProvider(async (key) => {
        await Promise.resolve();
        return { PORT: "8080" }[key];
      });
    await expect(instance.port).resolves.toBe(8080);
  });

  it("throws a descriptive error for a missing required var", async () => {
    const instance = env
      .register({
        databaseUrl: { key: "DATABASE_URL", validation: z.string() },
      })
      .withProvider(async () => undefined);
    await expect(instance.databaseUrl).rejects.toThrow(
      /Missing env var 'DATABASE_URL'/,
    );
  });

  it("throws for an invalid value", async () => {
    const instance = env
      .register({ port: { key: "PORT", validation: z.coerce.number() } })
      .withProvider(from({ PORT: "abc" }));
    await expect(instance.port).rejects.toThrow(/Invalid env var 'PORT'/);
  });

  it("resolves to undefined for an optional missing var", async () => {
    const instance = env
      .register({ debug: { key: "DEBUG", validation: z.string().optional() } })
      .withProvider(async () => undefined);
    await expect(instance.debug).resolves.toBeUndefined();
  });

  it("applies a schema default", async () => {
    const instance = env
      .register({
        port: { key: "PORT", validation: z.coerce.number().default(3000) },
      })
      .withProvider(async () => undefined);
    await expect(instance.port).resolves.toBe(3000);
  });

  it("registers an env.var node once per declared name in collect mode", () => {
    env
      .register({
        alpha: { key: "ALPHA", validation: z.string() },
        beta: { key: "BETA", validation: z.coerce.number() },
      })
      .withProvider(from({}));
    const vars = lookupAll("env.var");
    expect(vars.map((v) => v.__key).sort()).toEqual(["alpha", "beta"]);
  });

  it("bypasses the cache when configured to ignore it", async () => {
    // #section - Bypass the cache
    let calls = 0;
    const live = env
      .register({
        featureFlag: { key: "FEATURE_FLAG", validation: z.string() },
      })
      .withProvider(
        async (key) => {
          calls += 1;
          return { FEATURE_FLAG: `on-${calls}` }[key];
        },
        { cache: false },
      );

    const a = await live.featureFlag;
    const b = await live.featureFlag; // provider called again
    // #endsection

    expect(a).toBe("on-1");
    expect(b).toBe("on-2");
    expect(calls).toBe(2);
  });

  describe("documentation examples", () => {
    it("declares and resolves an env var", async () => {
      // #section - Declare and resolve an env var
      const instance = env
        .register({
          databaseUrl: { key: "DATABASE_URL", validation: z.string() },
        })
        .withProvider(from({ DATABASE_URL: "postgres://x" }));
      const url = await instance.databaseUrl;
      // #endsection

      expect(url).toBe("postgres://x");
    });

    it("coerces and defaults env values", async () => {
      // #section - Coerce and default env values
      const instance = env
        .register({
          port: { key: "PORT", validation: z.coerce.number().default(3000) },
        })
        .withProvider(async () => undefined);
      const port = await instance.port;
      // #endsection

      expect(port).toBe(3000);
    });

    it("reads optional env vars", async () => {
      // #section - Read optional env vars
      const instance = env
        .register({
          debug: { key: "DEBUG", validation: z.string().optional() },
        })
        .withProvider(async () => undefined);
      const debug = await instance.debug;
      // #endsection

      expect(debug).toBeUndefined();
    });
  });
});
