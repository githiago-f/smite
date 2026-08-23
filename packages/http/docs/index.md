# @smitejs/http

The HTTP DSL and executor. Run the tests in `src/index.test.ts` and the
runtime contract in `src/tree-shake.test.ts` for the executable examples.

## CLI workflow

Install the HTTP package and CLI with `npm install @smitejs/http zod` and
`npm install -D @smitejs/cli`. Put the app entry in `smite.config.ts`, then
use `npx smite dev` to run it locally or `npx smite build` to bundle it for
deployment. The HTTP package stays independent of the Node transport; the CLI
supplies the local `node:http` server.

## Usage

```ts
import { http } from "@smitejs/http";
import { z } from "zod";

const app = http.app("my-api");
const routes = http.router().input({
  params: z.object({ id: z.string() }),
  query: z.object({ q: z.string().optional() }).partial(),
});
routes
  .accept("GET", "/users/:id")
  .handler((ctx) => ({ status: 200, body: { id: ctx.params.id } }));
app.use(routes);

export const router = app.serve();
// router({ method: "GET", path: "/users/42", query: {}, headers: {}, body: undefined })
```

## API

- `http.app(name?)` — an app reference (`use`, `serve`). Inject routers and
  aspects with `app.use(...)`; serve with `serve(app)` directly.
- `http.router(config?)` — a standalone route builder (`input(config)`,
  `accept(method, path)`, and per-method shortcuts). Inject it into an app
  with `app.use(router)`.
- `input(RouteInputConfig)` — zod schemas per bucket (`query`, `params`,
  `headers`, `body`); types are inferred into the handler context.
- `app.use(...injectables)` — injects routers and aspects
  (`aspect.middleware`, `aspect.guard`, `aspect.interceptor`,
  `aspect.filter`) into the request pipeline.
- `accept(method, path)` — an `HttpEndpointBuilder` (`.input(config)`,
  `.handler(fn)`).
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
