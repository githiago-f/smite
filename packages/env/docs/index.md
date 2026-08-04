# @smite/env

Declarative environment variables for Smite. Declare which variables a scope
needs, where they come from (a provider), and how they are validated (zod).
Run the tests in `src/index.test.ts` for the executable contract.

## CLI workflow

Install it with `npm install @smite/env zod`, declare the environment in your
app entry, and run `npx smite dev` or `npx smite build` from the project that
contains `smite.config.ts`. The CLI compiles the declaration with the rest of
the app; values are still resolved by the provider at runtime.

## Usage

```ts
import { env } from "@smite/env";
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

## API

- `env.register(specs)` — declares variables as `{ key, validation }` pairs and
  returns a builder. `key` is the raw provider key (e.g. the `process.env`
  name); `validation` is the zod schema, the single source of truth for
  optionality, defaults, and coercion.
- `builder.withProvider(fn, opts?)` — attaches the source of raw values,
  `(key: string) => Promise<unknown>`, and returns the env instance. Always
  async, so sync and async sources share one resolution path. Pass
  `{ cache: false }` to re-read through the provider on every access instead of
  caching.
- The instance — one lazily-resolved typed property per declared name:
  `await appEnv.databaseUrl`. Each instance has its own provider and cache, so
  different scopes never collide.

## Scope, not singleton

`env.register(...)` creates a fresh instance; nothing is global. Two callers can
declare the same key with different validations, or attach different providers,
without interfering. Reading happens through the instance you built.

## Build-time manifest

Each declared name is also recorded in a build-time manifest. The future CLI
uses it to scaffold `.env.example` templates and to validate required vars at
compile time.
