# 10. HTTP Endpoint and Handler (`accept` + `handler`)

## Goal

Implement the rest of the sketch's declaration DSL:

```ts
route.accept(HttpMethod.GET, "/:id").handler((ctx) => { ... });
route.accept(HttpMethod.GET, "/").handler((ctx) => { ... });
```

- `route.accept(method, path)` creates a `"http.endpoint"` node wired to the
  route (`route -> endpoint` edge).
- `.handler(fn)` creates a `"http.handler"` node wired to the endpoint
  (`endpoint -> handler` edge) holding the runtime function reference.

Every element is IR: endpoint nodes, handler nodes, and both edges.

## Context

In the old project, `defineRoute` fused method+path+handler into a single
route descriptor and attached a runtime `eventHandler`. The new DSL splits the
concerns: a **route** groups **endpoints** (one verb+path each), and each
endpoint owns a **handler**. This granularity is what lets the CLI generate
OpenAPI per-endpoint and lets `serve()` match precisely.

## Harness alignment

- **KISS** — three tiny node kinds, two edges; no middleware pipeline yet.
- **DRY** — the endpoint and handler builders reuse `defineDescriptor` +
  `relate`; nothing re-implements wiring.
- **SOLID** — the handler is an opaque `HttpHandler` reference (interface
  segregation): `serve` only needs to call it; the CLI never needs it.
- **Clean** — the node graph mirrors the sketch's call graph one-to-one:
  app → route → endpoint → handler.

## Design

### File: `packages/http/src/endpoint.ts`

```ts
import { defineDescriptor, relate } from "@smitejs/core";
import type { Descriptor, RelationshipDescriptor } from "@smitejs/core";
import type { HttpHandler, HttpMethod, RouteInputConfig } from "./types.js";

export interface EndpointDescriptor extends Descriptor<
  "http.endpoint",
  { readonly method: HttpMethod; readonly path: string }
> {}

export interface HandlerDescriptor extends Descriptor<
  "http.handler",
  { readonly fn: HttpHandler }
> {}

export interface HttpEndpointBuilder<
  Config extends RouteInputConfig = RouteInputConfig,
> {
  readonly descriptor: EndpointDescriptor;
  readonly handler: (fn: HttpHandler<Config>) => void;
}

export function accept<Config extends RouteInputConfig>(
  route: Descriptor<"http.route", { req?: RouteInputConfig }>,
  method: HttpMethod,
  path: string,
): HttpEndpointBuilder<Config> {
  const descriptor = defineDescriptor("http.endpoint", `${method} ${path}`, {
    method,
    path,
  });

  relate(route, "http.endpoint", descriptor);

  return {
    descriptor,
    handler: (fn) => {
      const handler = defineDescriptor("http.handler", "http.handler", { fn });
      relate(descriptor, "http.handler", handler);
    },
  };
}
```

Key decisions:

- **Endpoint key** = `"<METHOD> <path>"`, mirroring the route's composite key.
  Uniqueness within an app is enforced by the registry.
- **Handler key** is `"http.handler"` — provisional. If a route declares
  multiple endpoints, each creates its own handler node; keys are unique per
  *edge* (composite edge key), so no registry collision occurs. If handlers
  need stable identity (e.g. for dependency edges), add an explicit name
  later.
- **`.handler` returns `void`**: the sketch never chains after it. Keeping it
  `void` (rather than returning the builder) avoids implying a meaningless
  return (Clean).
- The handler `fn` lives in the handler node's `data` (runtime metadata, per
  the runtime/build-time separation skill). The CLI must never touch it.

### Wiring summary

```
app ──"http.route"──> route ──"http.endpoint"──> endpoint ──"http.handler"──> handler
```

The executor (slice 11) walks exactly this chain via `childrenOf`.

## Implementation steps

1. Create `packages/http/src/endpoint.ts`.
2. In `packages/http/src/index.ts`, import and re-export `accept`,
   `HttpEndpointBuilder`, `EndpointDescriptor`, `HandlerDescriptor`:

   ```ts
   export { accept } from "./endpoint.js";
   export type {
     EndpointDescriptor,
     HandlerDescriptor,
     HttpEndpointBuilder,
   } from "./endpoint.js";
   ```

3. Ensure `route.accept` delegates to `accept(descriptor, method, path)` and
   keeps the route's `Config` generic (slice 09).
4. `yarn build` + `yarn test`.

## Edge cases & error handling

- **Duplicate endpoint**: `route.accept(GET, "/x")` twice throws (endpoint key
  `"GET /x"` duplicates). This is the desired OpenAPI-style guarantee.
- **Endpoint without handler**: allowed by the primitives; `serve()` treats it
  as a `404`/`501` (decided in slice 11). The CLI may warn.
- **Multiple handlers per endpoint**: calling `.handler` twice creates a
  second handler node under the endpoint; `serve()` (slice 11) picks the first
  child. The CLI should validate exactly-one-handler. For now, document.

## Verification

```bash
yarn build
yarn test
```

Assertions (promoted to slice `12_http_tests`):

- `childrenOf(route, "http.endpoint")` has one endpoint per `accept`.
- `childrenOf(endpoint, "http.handler")` has the handler node, whose
  `data.fn` is the passed function.
- Edge kinds `"http.endpoint"` and `"http.handler"` appear in
  `relationships()`.
- Calling `accept` with the same method+path twice throws.

Definition of done:

- The full declaration chain (app → route → endpoint → handler) is recorded as
  nodes + edges, and `http.route(app).accept(...).handler(...)` compiles with
  a correctly-typed `ctx` (from slice 09).

## Dependencies / prerequisites

- Slices `08`, `09` (route/app builders, `RouteInputConfig`, `HttpHandler`).

## Notes / open questions

- The `HttpHandler` default `Config` is `RouteInputConfig`; when a route has no
  `req`, handlers receive raw fallback buckets — consistent with slice 09.
- Future: guards/filters would slot in as siblings or as their own edges on the
  route/endpoint. The graph model supports it without changing this slice.
