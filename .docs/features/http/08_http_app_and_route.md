# 08. HTTP App and Route (`http.app`, `http.route`)

## Goal

Implement the first slice of the `@smitejs/http` DSL, matching the sketch
(`packages/http/src/index.ts`):

```ts
const app = http.app();
const route = http.router(app);
```

`http.app()` wraps the core junction (slice 05). `http.router(app)` creates a
`"http.route"` node and **registers itself as a route of `app`** — the exact
wiring behavior the requirements call out.

## Context

The sketch shows a registry-driven DSL where calling `route(app)` both creates
the route IR *and* records the relationship to the app. Our `relate` primitive
(slice 04) makes this a one-liner. The DSL deliberately avoids a `routeBuilder`
class: `http.router(app)` is a function returning a small builder object.

## Harness alignment

- **KISS** — plain functions returning frozen-ish builder objects; no classes,
  no decorators, no magic.
- **DRY** — constants (`HttpMethod`, `HttpStatus`) are defined once; the route
  uses core's `defineDescriptor` + `relate` rather than re-implementing IR.
- **SOLID** — `http` depends on `@smitejs/core` (Dependency Inversion); core
  never imports http (no cycles). The HTTP package owns HTTP vocabulary only.
- **Clean** — the DSL reads top-to-bottom like the sketch; registration is
  explicit through core primitives, no hidden globals in `http`.

## Design

### Constants: tree-shakeable (not `enum`)

TS `enum`s emit runtime objects that **esbuild cannot tree-shake**. Because
tree-shaking is a hard requirement, use `const` objects + literal unions:

```ts
export const HttpMethod = {
  ANY: "ANY",
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
  OPTIONS: "OPTIONS",
  HEAD: "HEAD",
  PATCH: "PATCH",
} as const;
export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;
export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];
```

Usage stays identical to the sketch: `HttpMethod.GET`, `HttpStatus.BAD_REQUEST`.

### Route node

```ts
import { createApp, defineDescriptor, relate } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";

export interface RouteInputConfig {
  readonly query?: import("zod").ZodType;
  readonly params?: import("zod").ZodType;
  readonly headers?: import("zod").ZodType;
  readonly body?: import("zod").ZodType;
}

export interface RouteDescriptor extends Descriptor<
  "http.route",
  { readonly req?: RouteInputConfig }
> {}

export interface HttpRouteBuilder {
  readonly descriptor: RouteDescriptor;
  readonly req: <Next extends RouteInputConfig>(
    config: Next,
  ) => HttpRouteBuilder<Next>;
  readonly accept: (
    method: HttpMethod,
    path: string,
  ) => import("./endpoint.js").HttpEndpointBuilder<RouteInputConfig>;
}
```

### App builder

```ts
export interface HttpAppBuilder {
  readonly descriptor: AppDescriptor;
  readonly route: (config?: RouteInputConfig) => HttpRouteBuilder;
  readonly serve: () => import("./serve.js").HttpRouter;
}

export function app(name?: string): HttpAppBuilder {
  const descriptor = createApp(name);
  return {
    descriptor,
    route: () => route(descriptor),
    serve: () => serve(descriptor),
  };
}
```

### The registration function

```ts
export function route(app: AppDescriptor): HttpRouteBuilder {
  const descriptor = defineDescriptor("http.route", "http.route", {
    // placeholder key — refined in slice 09 when the route gets its identity
  }) as RouteDescriptor;

  relate(app, "http.route", descriptor);

  return {
    descriptor,
    req: (config) => {
      refine(descriptor, { req: config });
      return builder as unknown as HttpRouteBuilder<typeof config>;
    },
    accept: (method, path) => accept(descriptor, method, path),
  };
}
```

> **Key note**: the route key is *provisional* in this slice. Slice
> `09_http_req_validation` defines the stable composite key (`"<method> <path>"`
> derived at `accept` time, or an explicit `name`). Do not over-invest in the
> placeholder; the shape above is what matters. (A `route(app, config?)`
> overload may set `req` eagerly.)

## Implementation steps

1. Add `zod` as a dependency of `packages/http` (`yarn workspace @smitejs/http
   add zod@^4`), since `RouteInputConfig` references its types.
2. Create `packages/http/src/index.ts` with `HttpMethod`, `HttpStatus`,
   `RouteInputConfig`, `RouteDescriptor`, `HttpRouteBuilder`, `HttpAppBuilder`,
   `app`, and `route`.
3. Add `{ "path": "../core" }` to `packages/http/tsconfig.json` references
   (and `"@smitejs/core": "*"` to its dependencies).
4. Stub `accept`/`serve` as exports in separate files
   (`endpoint.ts`, `serve.ts`) with minimal signatures — they are implemented
   in slices `10` and `11`. Keep `tsc -b` green.
5. `yarn build` + `yarn test`.

## Edge cases & error handling

- **Unnamed apps**: `http.app()` maps to `createApp()` → key `"app"`; a second
  one throws (slice 05 guard). Tests in slice `12` cover it.
- **Route without endpoints**: valid; `serve()` answers `404` (slice 11).
- **Duplicate route registration**: `relate`'s composite key makes a second
  `route(app)` registration a duplicate-edge error — but only after the route
  key stabilizes (slice 09). Covered there.

## Verification

```bash
yarn build
yarn test
```

Manual sanity (temporary, replaced by slice 12 tests):

```ts
import { http } from "@smitejs/http";
const app = http.app();
const route = http.router(app);
// childrenOf(app.descriptor, "http.route") has 1 entry
```

Definition of done:

- `http.app()` returns an `HttpAppBuilder` with a core `AppDescriptor`.
- `http.router(app)` creates a `"http.route"` node and wires it into `app`
  (`childrenOf(app, "http.route")` sees it; the edge is in `relationships()`).

## Dependencies / prerequisites

- Slices `02`–`06` (`@smitejs/core` barrel: `createApp`, `defineDescriptor`,
  `relate`, `refine`).
- Slice `01` (workspace scaffolding for `@smitejs/http`).

## Notes / open questions

- The route key placeholder must be resolved before slice `12_http_tests`.
  Options: composite `"<METHOD> <path>"` derived from the first `accept`
  (matches the old project's `defineRoute`), or an explicit `name` parameter.
  Recommendation: composite from `accept`, falling back to `"route"`.
- `http.router(app)` is the sketch's spelling; `app.route()` also exists on the
  builder for ergonomics. Keep both? Lean yes — the sketch uses the free
  function; the builder method is a convenience alias (DRY: both delegate to
  one implementation).
