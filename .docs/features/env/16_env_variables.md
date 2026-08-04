# 16. Environment Variables (`@smitejs/env`)

## Goal

Let an app declare which environment variables a scope needs and where they come
from. `env.register` declares variables as `{ key, validation }` pairs and
returns a builder; `builder.withProvider` attaches a provider (always async:
`(key) => Promise<unknown>`) and yields a scoped instance with one typed async
property per declared name. zod schemas validate every entry (type,
requiredness, defaults). Values are resolved lazily and cached per instance, and
every declared var is registered into the global registry in collect mode so the
future CLI can emit `.env.example` templates and flag missing required vars at
compile time.

## Context

The runtime/build-time separation applies here too: the *declaration* of a var
(`env.var` nodes, collect mode) is build-time metadata; the *resolution* is a
runtime concern. The provider is the seam between them — it says where values
come from (`process.env`, a secrets store, …) without the framework caring.

Env is **factory-only, not a global singleton**: `env.register` creates a fresh
instance with its own provider and cache. Different scopes can declare the same
key differently or read from different sources without colliding.

Per the roadmap, the CLI will need a manifest of required vars; the registrar
already gives us the mechanism.

## Design

### File: `packages/env/src/index.ts`

```ts
import { defineDescriptor, lookup } from "@smitejs/core";
import type { z } from "zod";

declare const ALLOW_GLOBAL_REGISTRY: boolean;

export type EnvProvider = (key: string) => Promise<unknown>;
export type EnvSpec<Value = unknown> = {
  readonly key: string;
  readonly validation: z.ZodType<Value>;
};
export type EnvSpecs = Readonly<Record<string, EnvSpec>>;
export type EnvInstance<Specs extends EnvSpecs> = {
  readonly [Name in keyof Specs]: Promise<z.infer<Specs[Name]["validation"]>>;
};
export interface EnvBuilder<Specs extends EnvSpecs> {
  readonly withProvider: (
    provider: EnvProvider,
    options?: { cache?: boolean },
  ) => EnvInstance<Specs>;
}

export function register<Specs extends EnvSpecs>(entries: Specs): EnvBuilder<Specs> {
  const specs = new Map<string, EnvSpec>();
  for (const [name, spec] of Object.entries(entries)) {
    if (typeof ALLOW_GLOBAL_REGISTRY === "boolean" && ALLOW_GLOBAL_REGISTRY) {
      const existing = lookup(name);
      if (existing === undefined || existing.__kind !== "env.var") {
        defineDescriptor("env.var", name, { spec });
      }
    }
    specs.set(name, spec);
  }
  return {
    withProvider: (provider) => {
      const cache = new Map<string, Promise<unknown>>();
      const instance = {} as EnvInstance<Specs>;
      for (const [name, spec] of specs) {
        Object.defineProperty(instance, name, {
          enumerable: true,
          get: () => {
            let pending = cache.get(name);
            if (pending === undefined) {
              pending = resolve(provider, spec);
              cache.set(name, pending);
            }
            return pending;
          },
        });
      }
      return Object.freeze(instance);
    },
  };
}
```

Resolution (`resolve(provider, spec)`):

- `await provider(spec.key)` returns the raw value.
- `spec.validation.safeParse(raw)` is the single validator: `.optional()` allows
  a missing var, `.default(v)` supplies a fallback, `z.coerce.number()` casts.
- On parse failure with an empty/`undefined` raw value the error reads
  `Missing env var '<key>'`; otherwise `Invalid env var '<key>'` — both include
  the first zod issue message.

### Collect mode

`register` emits an `env.var` descriptor (`defineDescriptor("env.var", name,
{ spec })`) guarded by the raw `ALLOW_GLOBAL_REGISTRY` identifier (slice 13
rule), skipping names already present so multiple scopes sharing a declaration
do not collide in the registry. In runtime bundles the node disappears.

### API

```ts
import { env } from "@smitejs/env";
import { z } from "zod";

const appEnv = env
  .register({
    databaseUrl: { key: "DATABASE_URL", validation: z.string() },
    port: { key: "PORT", validation: z.coerce.number().default(3000) },
    debug: { key: "DEBUG", validation: z.string().optional() },
  })
  .withProvider(async (key) => process.env[key]);

const port = await appEnv.port; // number
```

## Implementation steps

1. `packages/env/package.json` — deps `@smitejs/core` + `zod`; `sideEffects:
   false`; standard exports/files/scripts shape.
2. `packages/env/tsconfig.json` — extends root, excludes `*.test.ts`,
   references `../core`.
3. `src/index.ts` (above), `src/index.test.ts`, `docs/index.md`.
4. Root: `tsconfig.build.json` reference; `vitest.config.ts` alias
   `@smitejs/env` → `packages/env/src/index.ts`.

## Edge cases & error handling

- **Reading an undeclared name** — impossible at type level (properties are
  derived from the spec map); at runtime a bare property access yields
  `undefined` rather than a promise.
- **Missing required value** — throws `Missing env var '<key>'`.
- **Invalid value** — throws `Invalid env var '<key>'`.
- **Shared declarations in collect mode** — the second `register` skips emitting
  an `env.var` node already present; instances themselves stay isolated.
- **Cache control** — resolved values are cached per instance by default;
  `withProvider(provider, { cache: false })` re-reads through the provider on
  every access for values that rotate or change underneath you.

## Verification

```bash
yarn test      # env suite: typed resolution, isolation, caching, missing/invalid, optional, default, collect-mode
yarn build
yarn check
```

Definition of done:

- `env.register(...).withProvider(...)` returns a scoped instance with typed
  async property accessors (`await appEnv.port`).
- Provider is always async: `(key) => Promise<unknown>`.
- zod is the single source of truth for type/required/default.
- Lazy + cached resolution per instance; provider called once per var.
- Collect mode exposes `lookupAll("env.var")`; runtime bundle contains no
  registry code (same rule as slice 13).

## Dependencies / prerequisites

- Slices `01`–`13` (registrar, tree-shaking rule, zod).

## Notes / open questions

- A future `env.invalidate()` (hot reload) and secret-rotation support are
  deferred.
- Property accessors give exact per-name inference from the declared map, so the
  `get` generic no longer exists.
