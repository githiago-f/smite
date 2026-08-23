# Smite

**Compile-time-first, serverless application framework for TypeScript.**

Smite is a declarative framework: you describe your HTTP API as plain values,
and Smite compiles that description at build time into everything you need — a
runtime server, a fully typed client, an OpenAPI document, serverless handlers —
then runs a tiny, tree-shakeable runtime with zero build-time machinery.

[![npm version](https://img.shields.io/npm/v/@smitejs/*)](https://www.npmjs.com/package/@smitejs/*)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/githiago-f/smite)

> **Full documentation lives at <https://githiago-f.github.io/smite/>** — API
> reference, concept guides and worked examples for every package. This README
> is the quick path from zero to a running, documented, deployed app.

---

## Why Smite?

- **Compile-time-first.** Routes, inputs and handlers are collected at build
  time into a semantic graph (an IR). Generators consume that graph to emit
  typed clients, OpenAPI documents and infrastructure artifacts. What ships to
  production is a runtime-only bundle with the registry folded out.
- **Zod-only validation.** Declare `query`/`params`/`headers`/`body` schemas
  once; the same schema drives runtime validation (400 on failure) *and* the
  handler's TypeScript types *and* the generated artifacts.
- **Tree-shakeable.** Production bundles drop the registry and collector
  entirely. Every package sets `sideEffects: false` and prefers `const` objects
  over `enum`.
- **Serverless-ready.** Serve over `node:http` in development, or adapt the same
  app to an AWS Lambda handler with one line.
- **Small, composable packages.** Pick what you need: HTTP, env vars, typed
  clients, OpenAPI, DDD tools, functional primitives.

## Packages

| Package | What it does |
| --- | --- |
| [@smitejs/core](https://www.npmjs.com/package/@smitejs/core) · [![npm](https://img.shields.io/npm/v/@smitejs/core)](https://www.npmjs.com/package/@smitejs/core) | Semantic registrar: IR nodes (descriptors), edges (relationships) and the global registry |
| [@smitejs/http](https://www.npmjs.com/package/@smitejs/http) · [![npm](https://img.shields.io/npm/v/@smitejs/http)](https://www.npmjs.com/package/@smitejs/http) | HTTP DSL (`app`, `route`, `accept`, `handler`) plus the `serve`/`serveNode` executors |
| [@smitejs/env](https://www.npmjs.com/package/@smitejs/env) · [![npm](https://img.shields.io/npm/v/@smitejs/env)](https://www.npmjs.com/package/@smitejs/env) | Declarative environment variables with zod validation |
| [@smitejs/fp](https://www.npmjs.com/package/@smitejs/fp) · [![npm](https://img.shields.io/npm/v/@smitejs/fp)](https://www.npmjs.com/package/@smitejs/fp) | Functional primitives: `Option`, `Result`, `Either`, `Task`, extractors, predicates |
| [@smitejs/domain](https://www.npmjs.com/package/@smitejs/domain) · [![npm](https://img.shields.io/npm/v/@smitejs/domain)](https://www.npmjs.com/package/@smitejs/domain) | Functional DDD toolkit: value objects, entities, ports, specifications, usecases |
| [@smitejs/client](https://www.npmjs.com/package/@smitejs/client) · [![npm](https://img.shields.io/npm/v/@smitejs/client)](https://www.npmjs.com/package/@smitejs/client) | Build-time typed-client codegen; ships a tiny `@smitejs/client/runtime` |
| [@smitejs/openapi](https://www.npmjs.com/package/@smitejs/openapi) · [![npm](https://img.shields.io/npm/v/@smitejs/openapi)](https://www.npmjs.com/package/@smitejs/openapi) | OpenAPI 3.1 generator plugin + Swagger UI router |
| [@smitejs/cli](https://www.npmjs.com/package/@smitejs/cli) · [![npm](https://img.shields.io/npm/v/@smitejs/cli)](https://www.npmjs.com/package/@smitejs/cli) | Compile-time toolchain: `smite dev`, `build`, `generate`, `deploy` |
| [@smitejs/aws](https://www.npmjs.com/package/@smitejs/aws) · [![npm](https://img.shields.io/npm/v/@smitejs/aws)](https://www.npmjs.com/package/@smitejs/aws) | AWS resource declarations, injected clients and IAM permission metadata |
| [@smitejs/serverless](https://www.npmjs.com/package/@smitejs/serverless) · [![npm](https://img.shields.io/npm/v/@smitejs/serverless)](https://www.npmjs.com/package/@smitejs/serverless) | Serverless adapters: `lambdaify` turns an app into an API Gateway v2 handler |
| [create-smite-app](https://www.npmjs.com/package/create-smite-app) · [![npm](https://img.shields.io/npm/v/create-smite-app)](https://www.npmjs.com/package/create-smite-app) | Scaffold a complete Smite project |
| [smite-cli](https://www.npmjs.com/package/smite-cli) · [![npm](https://img.shields.io/npm/v/smite-cli)](https://www.npmjs.com/package/smite-cli) | The `smite` binary |

---

## Getting started

### Scaffold a new project

```bash
yarn create smite-app hello-api
cd hello-api
npm install
npm run dev
```

The default template includes an HTTP app (`src/app.ts`), a Node server
(`src/server.ts`), a `smite.config.ts` wired with the typed-client and OpenAPI
generators, and the `dev`/`generate`/`build` scripts. Open
<http://127.0.0.1:3000/health> and browse the generated docs at
<http://127.0.0.1:3000/docs>.

Prefer a leaner start? `yarn create smite-app hello-api --template minimal` keeps
just the app and the typed client.

### Install into an existing project

```bash
npm install -D @smitejs/cli
npm install @smitejs/http zod
```

Scaffold the starter files into the current project:

```bash
npx smite create hello-api
```

Then add the tools you need as you go: `@smitejs/env`, `@smitejs/client`,
`@smitejs/openapi`, `@smitejs/domain`, `@smitejs/fp`.

---

## Your first app

Describe the API as plain values — no `createServer` boilerplate, no decorators:

```ts
// src/app.ts
import { http } from "@smitejs/http";
import { z } from "zod";

export const app = http.app("greeter");

const routes = http.router().input({
  query: z.object({ name: z.string().optional() }).partial(),
});

routes
  .accept("GET", "/hello")
  .handler((ctx) => ({
    status: 200,
    body: { message: `Hello, ${ctx.query.name ?? "world"}!` },
  }));

app.use(routes);
```

Serve it over `node:http`:

```ts
// src/server.ts
import { serveNode } from "@smitejs/http";
import { app } from "./app";

const server = serveNode(app);
server.listen(3000, () => console.log("http://127.0.0.1:3000"));
```

Call it:

```bash
curl http://127.0.0.1:3000/hello?name=Ada   # {"message":"Hello, Ada!"}
curl http://127.0.0.1:3000/hello            # {"message":"Hello, world!"}
```

The `query` schema is optional as a whole and `name` is optional within it; the
handler's `ctx.query.name` is already validated and typed. Invalid input is
rejected with a `400` before your handler runs.

---

## How to do everything

### HTTP apps and routes

Everything hangs off one reference: `http.app(name?)` returns an app carrying
`use()` (inject routers and aspects) and `serve()`.

```ts
import { http } from "@smitejs/http";

const app = http.app("store");
const routes = http.router({
  name: "users",              // route key (defaults to an auto-number)
  summary: "User resources",  // → OpenAPI summary
  description: "…",           // → OpenAPI description
});

routes.accept("GET", "/users").handler((ctx) => ({ status: 200, body: [] }));
routes.accept("GET", "/users/:id").handler((ctx) => ({
  status: 200,
  body: { id: ctx.params.id },
}));

app.use(routes);
```

- Routes are unique within an app; the same route name can repeat across apps.
- `accept` takes any method from `HttpMethod` (`GET`, `POST`, `PUT`, `PATCH`,
  `DELETE`, `OPTIONS`, `HEAD`, and `ANY` which matches every method).
- Path parameters use `:param` syntax (`/users/:id/posts/:postId`).

See also the docs: [Apps and routes](https://githiago-f.github.io/smite/).

### Declared inputs (validation)

`http.router().input(config)` declares zod schemas per bucket — `query`,
`params`, `headers`, `body`. Declare a bucket and it is validated at serve time
(400 on failure) and inferred into the handler context:

```ts
import { http } from "@smitejs/http";
import { z } from "zod";

const routes = http.router().input({
  query: z.object({ q: z.string().optional() }).partial(),
  params: z.object({ id: z.coerce.number(), postId: z.coerce.number() }).partial(),
  body: z.object({ name: z.string().min(1) }).optional(),
});

routes.accept("POST", "/users/:id/posts/:postId").handler((ctx) => {
  ctx.query.q;       // string | undefined  (typed from the schema)
  ctx.params.id;     // number | undefined
  ctx.body?.name;    // string | undefined
  return { status: 201, body: { ok: true } };
});

app.use(routes);
```

Undeclared buckets degrade to sensible loose types. Undeclared schemas are not
validated. Zod is the only validation system — Smite does not invent a second
one.

### Responses

Handlers may return anything. An object with a `status` is used as-is; any other
value becomes `{ status: 200, body: value }`.

```ts
import { http, json, status } from "@smitejs/http";

const app = http.app("responses");
const routes = http.router();

routes.accept("GET", "/").handler(() => ({ ok: true }));           // 200 { ok: true }
routes.accept("GET", "/a").handler(() => ({ status: 201, body: { created: true } }));
routes.accept("GET", "/b").handler(() => json({ ok: true }));      // 200
routes.accept("GET", "/c").handler(() => status(201).json({ ok: true }));

app.use(routes);
```

### Extractors (cookies, headers, params, query)

Reusable readers return an `Option` and compose with `chain` (first hit wins):

```ts
import { http, chain } from "@smitejs/http";

const session = chain(http.cookies("session"), http.headers("x-session"));

route.accept("GET", "/me").handler((ctx) => {
  const token = session(ctx.request).unwrapOr("anonymous");
  return { status: 200, body: { token } };
});
```

`http.headers(name)`, `http.params(name)`, `http.query(name)` work the same way.

### Serving

- `serve(app)` → a pure `(request) => Promise<response>` router. Useful for
  testing and for embedding Smite in other servers.
- `serveNode(app, options?)` → a `node:http` `Server`. Options:
  - `docs`: mount extra routers (e.g. Swagger UI) at exact paths, checked before
    the app's routes.
  - `transformRequest`: adapt the parsed request before dispatch.

```ts
import { serveNode } from "@smitejs/http";
import { swaggerUi } from "@smitejs/openapi";

const server = serveNode(app, {
  docs: {
    router: swaggerUi({ doc, title: "Pets API" }),
    paths: ["/docs", "/openapi.json"],
  },
  transformRequest: async (req, parsed) => ({ ...parsed, headers: parsed.headers }),
});
```

### Config and the CLI

`smite.config.ts` is the composition root: which apps to compile and which
generators to run.

```ts
// smite.config.ts
import { defineSmiteConfig } from "@smitejs/cli";
import { client } from "@smitejs/client";
import { openapi } from "@smitejs/openapi";

export default defineSmiteConfig({
  entry: "./src/app.ts",           // or `entries: ["./src/app.ts"]`
  plugins: [
    client({ outfile: "./src/app.client.ts" }),
    openapi({ outfile: "./openapi.json", title: "Pets API" }),
  ],
});
```

Commands (via the `smite` binary, from `@smitejs/cli` or `smite-cli`):

| Command | What it does |
| --- | --- |
| `smite dev` | Run generators, bundle a `node:http` server, serve it and auto-reload on change |
| `smite build` | Run generators and bundle runtime entries into `dist/` for deployment |
| `smite generate <plugin>` | Run a single generator plugin against the compiled app |
| `smite list` | List the plugins declared in `smite.config.ts` |
| `smite create <name>` | Scaffold starter files into the current project |
| `smite deploy <plugin>` | Generate artifacts, then deploy through a provider plugin |

Use `--config <path>` to point at a non-default config, `--port`/`--host` for
`dev`, and `--app-name` to disambiguate when several apps are declared. The
generated `src/server.ts` shares the same `serveNode` adapter as the dev loop, so
what you test locally is what you deploy.

### Typed client generation

`@smitejs/client` compiles your app at build time and emits a builder-style,
fully typed client. It is the same engine behind `smite dev` and the `client()`
plugin.

```ts
import { generate } from "@smitejs/client";

await generate({
  entry: "./src/app.mjs",
  outfile: "./src/generated-client.ts",
});
```

Or, more commonly, add the `client()` plugin to `smite.config.ts` and run
`npx smite generate client` (or let `smite dev` do it). The generated client
imports only the tiny `@smitejs/client/runtime` and mirrors every route:

```ts
import { configure, api } from "./app.client";

configure({ baseUrl: "http://127.0.0.1:4000" });

const pets = await api.pets.$get({ query: { page: 2 } });
const pet = await api.pets.$id.$get({ params: { id: 42 } });
const created = await api.pets.$post({ body: { name: "Rex" } });

pets.status;      // 200
pets.body;        // parsed JSON
pets.headers;     // response headers
```

`configure` sets module-level defaults (`baseUrl`, `fetch`); any call can
override per-request with `$config`. Non-2xx responses are returned, never
thrown.

### OpenAPI and Swagger UI

Add the `openapi()` plugin to `smite.config.ts` to emit an OpenAPI 3.1 document
from your declared routes (zod schemas become JSON Schema via
`.toJSONSchema()`):

```ts
openapi({
  outfile: "./openapi.json",
  title: "Pets API",
  version: "1.0.0",
  servers: [{ url: "https://api.example.com" }],
})
```

Serve it with the Swagger UI router, either from a document or re-read from a
file on every request:

```ts
import { serveNode } from "@smitejs/http";
import { swaggerUiFromFile } from "@smitejs/openapi";

const server = serveNode(app, {
  docs: {
    router: swaggerUiFromFile({ file: "./openapi.json", title: "Pets API" }),
    paths: ["/docs", "/openapi.json"],
  },
});
```

### Environment variables

`@smitejs/env` declares variables with zod validation and resolves them through
a provider you supply (so it works on any platform — Node, Lambda, edge):

```ts
import { env } from "@smitejs/env";
import { z } from "zod";

const config = env
  .register({
    port: { key: "PORT", validation: z.coerce.number().int().positive() },
    greeting: { key: "GREETING", validation: z.string().min(1) },
  })
  .withProvider((key) => Promise.resolve(process.env[key]), { cache: true });

const port = await config.port;  // validated number
```

Missing or invalid values throw with a clear message; set `cache: false` to
re-read through the provider on every access. In collect mode each variable is
also registered as an IR node, so the CLI can scaffold `.env.example` files.

### Functional primitives

`@smitejs/fp` is a small, zero-dependency set of building blocks used across the
framework and available to your code:

```ts
import { Option, Result, Task, TaskResult, Matcher, flow, not } from "@smitejs/fp";

const maybe = Option.fromNullable(input?.userId).map(Number).filter(Number.isFinite);
const out = Result.fromThrowable(() => JSON.parse(raw), () => "parse error");
const res = await TaskResult.from(async () => db.load(id))
  .map((u) => ({ ...u, loaded: true }))
  .recover((e) => fallback)
  .run();

const role = Matcher.from(res).ok((u) => u.role).err((e) => e.error).run();
const pipeline = flow((n) => n + 1, (n) => n * 10);
const isGuest = not((v) => v === "member");
```

Included: `Option`, `Either`, `Result`, `Task`, `TaskResult`, `Matcher`,
`flow`/`pipe`, predicates (`and`, `or`, `not`, `isString`, `isNumber`,
`isUUID`, `isEmpty`), and compile-time-introspectable extractors (`chain`,
`getExtractorMetadata`).

### Domain-driven design

`@smitejs/domain` is a functional DDD toolkit. Model the domain with small
primitives, then wire usecases into HTTP handlers:

```ts
import { domain } from "@smitejs/domain";
import { Result } from "@smitejs/fp";
import { z } from "zod";

const Order = domain.entity({
  name: "Order",
  id: "id",
  schema: z.object({
    id: z.string().min(1),
    sku: z.string().min(1),
    qty: z.number().int().positive(),
    status: z.enum(["pending", "placed"]),
  }),
});

const OrderRepository = domain.port({
  name: "OrderRepository",
  methods: ["findById", "save"],
});

const withinCartLimit = domain.specification({
  name: "withinCartLimit",
  predicate: (input) =>
    input.qty <= 12 ? Result.ok(true) : Result.err("cart-limit", { max: 12 }),
});

const placeOrder = domain.command({
  name: "placeOrder",
  input: z.object({ sku: z.string().min(1), qty: z.number().int().positive() }),
  deps: [OrderRepository.name],
  handle: async ({ [OrderRepository.name]: orders }, input) => { /* … */ },
});
```

Builders: `valueObject`, `entity`, `specification` (+ `mergeSpecifications`),
`port`, `usecase`, `command`/`query`, `aggregate`, `projection`. The `handler`
helper binds a usecase to an HTTP endpoint with its dependencies:

```ts
import { domain } from "@smitejs/domain";
import { http } from "@smitejs/http";

const deps = { [OrderRepository.name]: makeStore() };
const routes = http.router();
routes
  .accept("POST", "/orders")
  .handler(domain.handler(placeOrder, deps));
app.use(routes);
```

### Serverless and AWS

Turn the same app into an AWS Lambda handler:

```ts
// handler.mjs
import { lambdaify } from "@smitejs/serverless/aws";
import { app } from "./app";

export const handler = lambdaify(app);
```

`lambdaify` adapts API Gateway v2 events to Smite requests (cookies, query,
base64 body) and maps responses back. `@smitejs/serverless` also provides a
`serverless()` generator plugin and `writeServerlessConfig`.

For infrastructure, `@smitejs/aws` declares resources and IAM permissions
without pulling the AWS SDK into the framework — you supply the client factory:

```ts
import { provider } from "@smitejs/aws";

const bucket = provider(
  "s3",
  { name: "uploads", bucketName: "my-bucket" },
  () => new S3Client({ region: "us-east-1" }),
);

// record IAM actions at build time; helpers emit CloudFormation fragments
bucket.requirePermissions(["s3:GetObject", "s3:PutObject"]);
```

Supported providers: `s3`, `ssm`, `dynamodb`, `sqs`, `eventbridge`. Resources
can be `managed` (Smite emits the CloudFormation definition via
`cloudFormationResourceOf`) or `imported` (via `import.exportName`).

---

## Examples

Runnable examples live in `examples/` (each is a yarn workspace):

| Example | Run |
| --- | --- |
| `http-rest-server` — routes, params/query validation, `serveNode` | `yarn workspace @smitejs/example-http-rest-server start` |
| `env-http` — declared env vars + HTTP | `yarn workspace @smitejs/example-env-http start` |
| `typed-client` — generate + call a typed client | `yarn workspace @smitejs/example-typed-client build` then `start:server` + `start:client` |
| `cli-app` — `smite.config.ts`, client + OpenAPI plugins, Swagger UI | `yarn workspace @smitejs/example-cli-app generate` then `start` |
| `domains-orders` — entities, specs, ports, commands/queries wired to HTTP | `yarn workspace @smitejs/example-domains-orders start` |
| `aws-lambda` — `lambdaify` an app and invoke it locally | `yarn workspace @smitejs/example-aws-lambda start` |
| `fp-utils` — `Option`, `Result`, `TaskResult`, `Matcher`, `flow` | `yarn workspace @smitejs/example-fp-utils start` |

There is also a routing benchmark (`yarn bench:http`) that compares a bundled
Smite server against Express and Fastify under k6.

---

## How it works

Smite compiles in two modes:

1. **Collect mode** (`ALLOW_GLOBAL_REGISTRY: true`). The CLI builds your entry
   with esbuild, executes it, and the DSL registers descriptor nodes and
   relationships into `globalThis.globalRegistry`. Generators traverse that
   graph — nothing is parsed from source, so artifacts reflect exactly what your
   app declared.
2. **Runtime mode** (`ALLOW_GLOBAL_REGISTRY: false`). Production bundles fold the
   registry out via esbuild `define`. Executors (`serve`, `serveNode`,
   `lambdaify`) walk the IR through child references only and never touch the
   registry.

The tree-shaking behavior is proven by a bundle test in `@smitejs/http`. The
full IR model is documented under [Internals](https://githiago-f.github.io/smite/).

## Development

This is a Yarn 1.x classic monorepo (workspaces in `packages/*` and
`examples/*`).

```bash
yarn install      # install all workspaces
yarn build        # tsc -b tsconfig.build.json (fp, core, http, env, client)
yarn test         # Vitest across all workspaces
yarn format       # Biome format
yarn biome check .  # Biome lint (plain `yarn check` is Yarn's own check)
yarn docs:build   # build the static docs site into dist/docs/
yarn docs:dev     # serve docs locally at http://127.0.0.1:4173
yarn docs:inject  # inject tested @example snippets into dist declarations
yarn bench:http   # routing benchmark vs Express/Fastify (Docker + k6)
```

Documentation is generated from JSDoc (`@group`/`@example`), concept markdown in
`packages/*/docs/concepts/`, and tested `#section` snippets — see
`AGENTS.md` for the full contribution guide.

## License

MIT © githiago-f
