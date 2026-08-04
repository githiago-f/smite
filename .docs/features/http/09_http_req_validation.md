# 09. Route Request Validation (`route.req`)

## Goal

Implement `route.req({ query?, params?, headers?, body? })`: a **zod-only**
declarative input spec stored on the route node, with **type-inferred handler
context** so `ctx.query`, `ctx.params`, `ctx.headers`, and `ctx.body` are
narrowed to the schemas' outputs.

This is where the DSL's type engineering pays off: the sketch expects
`ctx.query.time` to be inferred from `z.object({ time: z.iso.date() })` without
any annotation.

## Context

The old project's `RouteDescriptorData.request` used exactly this shape
(`Partial<Record<keyof APIGatewayUnion, z.ZodType>>`) and its `SafeInput`
type did `{ [K in keyof I]: z.infer<I[K]> }`. We generalize the buckets to
`query / params / headers / body` (transport-facing, not AWS-facing) and carry
the config through the builder generics.

Validation is zod-only by requirement: the framework accepts `z.ZodType`
schemas and nothing else.

## Harness alignment

- **KISS** — four optional fields, one generic, no schema-wrapping API.
- **DRY** — the inferred-context type is derived once from
  `RouteInputConfig`; handlers never re-declare their own input types.
- **SOLID** — the *Open/Closed* principle lives in the generics: adding a
  bucket is additive; existing route types recompile without breaking.
- **Clean** — the type mapping is the single source of truth for what a
  handler receives; runtime and type-level views are generated from the same
  config.

## Design

### File: `packages/http/src/types.ts`

```ts
import type { z } from "zod";

export interface RouteInputConfig {
  readonly query?: z.ZodType;
  readonly params?: z.ZodType;
  readonly headers?: z.ZodType;
  readonly body?: z.ZodType;
}

export type InferBucket<Config, Key extends keyof RouteInputConfig> =
  Config extends Record<Key, infer Schema extends z.ZodType>
    ? z.infer<Schema>
    : never;

export interface HttpRequest {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, unknown>>;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly params: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

export type HttpHandler<Config extends RouteInputConfig = RouteInputConfig> = (
  ctx: HttpHandlerContext<Config>,
) => unknown | Promise<unknown>;

export type HttpHandlerContext<Config extends RouteInputConfig> = {
  readonly request: HttpRequest;
} & {
  readonly query: [Config["query"]] extends [z.ZodType]
    ? z.infer<Config["query"]>
    : Readonly<Record<string, unknown>>;
  readonly params: [Config["params"]] extends [z.ZodType]
    ? z.infer<Config["params"]>
    : Readonly<Record<string, string>>;
  readonly headers: [Config["headers"]] extends [z.ZodType]
    ? z.infer<Config["headers"]>
    : Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly body: [Config["body"]] extends [z.ZodType]
    ? z.infer<Config["body"]>
    : unknown;
};
```

Notes:

- The `[Config["query"]] extends [z.ZodType]` tuple trick prevents
  distributivity/`never` pitfalls when the key is missing (KISS but
  type-correct).
- Missing buckets get a safe fallback (raw `Record` / `unknown`), so handlers
  compile even before a schema is declared.
- `z.infer` from zod v4 gives the **output** type of the schema.

### Route builder with config generics

`packages/http/src/index.ts` (updated route builder):

```ts
export interface HttpRouteBuilder<
  Config extends RouteInputConfig = RouteInputConfig,
> {
  readonly descriptor: RouteDescriptor<Config>;
  readonly req: <Next extends RouteInputConfig>(
    config: Next,
  ) => HttpRouteBuilder<Next>;
  readonly accept: (
    method: HttpMethod,
    path: string,
  ) => HttpEndpointBuilder<Config>;
}
```

- `req` replaces the config wholesale with the new generic `Next` (KISS: one
  `req` call per route; combine buckets in a single object).
- `accept` *retains* the route's `Config` so the endpoint's `.handler` infers
  the correct context.

### Stable route key

Resolve slice 08's placeholder: the route node's key becomes composite from
its first `accept` — `"<METHOD> <path>"` (mirrors the old
`defineRoute` key `${method} ${path}`). Routes without an `accept` keep key
`"http.route"` (rare; validation in slice 12 flags it if desired).

```ts
export function route<Config extends RouteInputConfig = RouteInputConfig>(
  app: AppDescriptor,
): HttpRouteBuilder<Config> {
  const descriptor = defineDescriptor("http.route", "http.route", {}) as RouteDescriptor<Config>;
  relate(app, "http.route", descriptor);

  const builder: HttpRouteBuilder<Config> = {
    descriptor,
    req: <Next extends RouteInputConfig>(config: Next) => {
      refine(descriptor, { req: config });
      return builder as unknown as HttpRouteBuilder<Next>;
    },
    accept: (method, path) => {
      const key = `${method} ${path}`;
      (descriptor as { __key: string }).__key = key;
      return accept(builder.descriptor, method, path);
    },
  };

  return builder;
}
```

> The `__key` reassignment on `accept` is a deliberate, single mutation point
> (documented): the key is derived from the method+path once the endpoint is
> declared. `refine` handles `data`; this handles identity. Revisited if the
> composite key proves fragile.

## Implementation steps

1. Create `packages/http/src/types.ts` with the types above.
2. Rewrite `packages/http/src/index.ts` route builder with `Config` generics
   and the stable key logic.
3. `yarn build` — verify the generic inference compiles.
4. Write a throwaway inference check in the test suite (promoted to real
   tests in slice `12`):

   ```ts
   const route = http.route(app).req({ query: z.object({ time: z.iso.date() }) });
   route.accept(HttpMethod.GET, "/").handler((ctx) => {
     ctx.query.time; // typed as the iso-date output
     return {};
   });
   ```

## Edge cases & error handling

- **`req` called twice**: the second call replaces the config (last write
  wins). Documented; not an error (KISS).
- **Empty `req({})`**: valid; all buckets fall back to raw types; `serve()`
  skips validation for missing buckets (slice 11).
- **`z.iso.date()`**: zod v4 API; if the installed version lacks it, tests use
  `z.string()` — but the sketch's example must compile, so pin zod `^4`.

## Verification

```bash
yarn build
yarn test
```

Definition of done:

- `ctx.query` (and friends) are inferred from `z.infer` for declared buckets.
- Route key stabilizes to `"<METHOD> <path>"` after the first `accept`.
- Route `data.req` holds the zod config; a type-level test asserts inference.

## Dependencies / prerequisites

- Slice `08_http_app_and_route` (route builder, app builder).
- `zod@^4` dependency in `@smitejs/http`.

## Notes / open questions

- The `__key` mutation is the least-clean point of the DSL. Alternative: the
  endpoint's `accept` registers the route again under the composite key and
  re-links — rejected as over-engineering. Keep the documented single mutation.
- Future: `route` may accept an optional `name` for explicitly keyed routes
  (e.g. multiple endpoints per route sharing a key). YAGNI until slice 12
  proves the composite key is insufficient.
