# @smite/http

The HTTP DSL and executor. Run the tests in `src/index.test.ts` and the
runtime contract in `src/tree-shake.test.ts` for the executable examples.

## Usage

```ts
import { http } from "@smite/http";
import { z } from "zod";

const app = http.app("my-api");
http.route(app)
  .req({
    params: { id: z.string() },
    query: z.object({ q: z.string().optional() }).partial(),
  })
  .accept("GET", "/users/:id")
  .handler((ctx) => ({ status: 200, body: { id: ctx.params.id } }));

export const router = app.serve();
// router({ method: "GET", path: "/users/42", query: {}, headers: {}, body: undefined })
```

## API

- `http.app(name?)` — an app reference (`route`, `serve`). Pass it to
  `http.route(app)` and `serve(app)` directly.
- `http.route(app)` — a route reference (`req(config)`, `accept(method, path)`).
- `req(RouteInputConfig)` — zod schemas per bucket (`query`, `params`,
  `headers`, `body`); types are inferred into the handler context.
- `accept(method, path)` — an `HttpEndpointBuilder` (`.handler(fn)`).
- `handler(ctx)` — returns `HttpResponse` or a raw body (wrapped as
  `{ status: 200, body }`).
- `serve(app)` — an `HttpRouter`: `(request) => Promise<HttpResponse>`. It
  freezes the app, matches paths (`path-to-regexp`), validates, dispatches,
  and returns 400/404 as appropriate.
- `http.json(body, status?)` and `http.status(code)` — response helpers.
- `http.cookies(name)`, `http.headers(name)`, `http.params(name)`,
  `http.query(name)` — extractors that read an optional value off the request
  (`Option<string>`), Fiber-style. `http.chain(...extractors)` tries them in
  order; `http.getExtractorMetadata(fn)` reads their `fp.extractor` metadata.
