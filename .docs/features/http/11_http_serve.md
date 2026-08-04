# 11. HTTP Serve Executor (`app.serve`)

## Goal

Implement the **terminal** of the http DSL: `app.serve()` walks the IR
exclusively through child refs (never the registry), matches a request against
endpoints via `path-to-regexp`, validates inputs with zod, dispatches the
handler with the typed context, and normalizes the result into an
`HttpResponse`.

The returned `HttpRouter` is exactly what a future `serverless` adapter will
wrap (`lambdaify(app)`), so it must be a plain `(request) => response` function.

## Context

The sketch ends with `const router = app.serve();`. `serve()` is the runtime
executor. It must not import the registry (tree-shaking), must not depend on
collect-mode state, and must be deterministic.

## Harness alignment

- **KISS** — a single function returning a single async function. No pipeline
  abstraction, no middleware engine, no DI container.
- **DRY** — matching and validation are pure helpers built once; response
  helpers (`json`, `status`) are tiny and reused by handlers.
- **SOLID** — `serve` depends on core's *abstractions* (`childrenOf`,
  `finalizeDescriptor`), not on concrete http internals beyond its own
  descriptors.
- **Clean** — separation: `serve.ts` (orchestration), `matcher.ts`
  (path-to-regexp), `validate.ts` (zod buckets), `response.ts` (helpers).

## Design

### File: `packages/http/src/serve.ts`

```ts
import { childrenOf, finalizeDescriptor } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import { match } from "path-to-regexp";
import type { z } from "zod";
import type {
  HttpHandler,
  HttpMethod,
  HttpRequest,
  HttpResponse,
  HttpStatus,
  RouteInputConfig,
} from "./types.js";

export type HttpRouter = (request: HttpRequest) => Promise<HttpResponse>;

type RouteNode = Descriptor<"http.route", { req?: RouteInputConfig }>;
type EndpointNode = Descriptor<"http.endpoint", { method: HttpMethod; path: string }>;

const toResponse = (result: unknown): HttpResponse => {
  if (
    result !== null &&
    typeof result === "object" &&
    "status" in result
  ) {
    return result as HttpResponse;
  }
  return { status: 200, body: result };
};

export function serve(app: AppDescriptor): HttpRouter {
  finalizeDescriptor(app);

  const routes = childrenOf(app, "http.route");
  const matchers = routes.flatMap((route) => {
    const routeNode = route as RouteNode;
    return childrenOf(routeNode, "http.endpoint").map((endpoint) => ({
      endpoint: endpoint as EndpointNode,
      config: routeNode.data.req,
      match: match(endpoint.data.path, { decode: decodeURIComponent }),
    }));
  });

  return async (request) => {
    for (const { endpoint, config, match: matchPath } of matchers) {
      const result = matchPath(request.path);
      if (result === false) continue;
      if (
        endpoint.data.method !== "ANY" &&
        endpoint.data.method !== request.method.toUpperCase()
      ) {
        continue;
      }

      const input = {
        params: result.params as Readonly<Record<string, string>>,
        query: request.query ?? {},
        headers: request.headers ?? {},
        body: request.body,
      };

      const validated = validate(config, input);
      if (validated.error) {
        return { status: 400, body: { error: validated.error } };
      }

      const [handlerNode] = childrenOf(endpoint, "http.handler") as readonly Descriptor<
        "http.handler",
        { fn: HttpHandler }
      >[];
      if (handlerNode === undefined) {
        return { status: 404, body: { error: "Not Found" } };
      }

      const ctx = {
        request,
        query: validated.data.query,
        params: validated.data.params,
        headers: validated.data.headers,
        body: validated.data.body,
      };

      return toResponse(await handlerNode.data.fn(ctx));
    }

    return { status: 404, body: { error: "Not Found" } };
  };
}
```

### File: `packages/http/src/validate.ts`

```ts
import type { z } from "zod";
import type { RouteInputConfig } from "./types.js";

type Bucket = "query" | "params" | "headers" | "body";

const parse = (schema: z.ZodType | undefined, value: unknown) => {
  if (schema === undefined) return { ok: true as const, data: value };
  const result = schema.safeParse(value);
  return result.success
    ? { ok: true as const, data: result.data }
    : { ok: false as const, error: result.error.issues };
};

export function validate(
  config: RouteInputConfig | undefined,
  input: Record<Bucket, unknown>,
) {
  const data = {} as Record<Bucket, unknown>;
  for (const bucket of Object.keys(input) as Bucket[]) {
    const parsed = parse(config?.[bucket], input[bucket]);
    if (!parsed.ok) return { error: parsed.error };
    data[bucket] = parsed.data;
  }
  return { data };
}
```

Only buckets declared in `req` are validated; missing schemas pass the raw
value through (consistent with slice 09's fallback types).

### File: `packages/http/src/response.ts`

```ts
import type { HttpResponse } from "./types.js";

export const json = (body: unknown, status = 200): HttpResponse => ({
  status,
  body,
});

export const status =
  (status: number) =>
  ({ json: (body: unknown): HttpResponse => ({ status, body }) });
```

Matches the sketch usage: `http.status(400).json(err)` and `http.json(res)`.

## Implementation steps

1. Add `path-to-regexp@^8` as a dependency of `@smitejs/http`.
2. Create `validate.ts`, `response.ts`, `serve.ts`.
3. Wire `app().serve()` → `serve(descriptor)` in `packages/http/src/index.ts`;
   export `json`, `status`, `HttpRouter`, `HttpRequest`, `HttpResponse`.
4. `yarn build` + `yarn test`.

## Edge cases & error handling

- **No match / no endpoint / no handler** → `404`.
- **Validation failure** → `400` with zod `issues` (structured, not a thrown
  error — KISS and friendly to adapters).
- **Handler returns an `HttpResponse`-shaped object** → passed through;
  anything else → `{ status: 200, body: result }`.
- **Method mismatch** on a matching path → continues to the next endpoint
  (allows `GET /x` + `POST /x` on the same route).
- **`finalizeDescriptor` before matching** guarantees the IR is immutable
  during serving (no accidental refinement mid-request).
- **Path decode**: `decodeURIComponent` keeps `%2F`-style segments readable;
  params are strings.

## Verification

```bash
yarn build
yarn test
```

Promoted to slice `12_http_tests`:

- `GET /users/42` matches endpoint `/:id` with `ctx.params.id === "42"`.
- Query schema `z.object({ time: z.iso.date() })` accepts a valid ISO string
  and rejects an invalid one (`400`).
- `POST /users` with a `body` schema returns the parsed body from the handler.
- Unknown path → `404`; missing handler → `404`.
- `finalizeDescriptor` froze the app (mutating a child throws).

Definition of done:

- `serve()` returns a working `HttpRouter` produced solely from child refs —
  no registry import in `serve.ts`.

## Dependencies / prerequisites

- Slices `08`–`10` (route/endpoint/handler IR + typed config).
- `path-to-regexp@^8` dependency.

## Notes / open questions

- **Method-agnostic `ANY`** is supported for future event/anything routes.
- The `request` object is normalized by the caller (the future `serverless`
  adapter turns API Gateway events into `HttpRequest`). This slice does not
  parse raw HTTP.
- Response helpers use plain numbers for status; `HttpStatus` constants remain
  available for handler ergonomics.
