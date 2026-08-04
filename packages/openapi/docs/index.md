# @smite/openapi

OpenAPI 3.1 artifact generator for Smite apps, delivered as an `@smite/cli`
plugin. Given the compiled app node, it walks the `http.route`/`http.endpoint`
graph via `@smite/http`'s `routesOf` and emits a JSON document whose operations
are derived from each route's `req` zod schemas.

## CLI workflow

Install it with `npm install -D @smite/openapi`. Add `openapi({ outfile:
"./openapi.json" })` to `smite.config.ts`, then run `npx smite generate
openapi`. Run `npx smite dev` after generation when your server mounts
`swaggerUi`; the raw document is available at `/openapi.json` and the
browser UI at `/docs`.

## Usage

```ts
import { defineSmiteConfig } from "@smite/cli";
import { openapi } from "@smite/openapi";

export default defineSmiteConfig({
  entries: ["./src/app.ts"],
  plugins: [openapi({ outfile: "./openapi.json" })],
});
```

```bash
smite generate openapi
```

## What is emitted

- One OAS path per endpoint template, with `:param` segments rewritten as
  `{param}`.
- `parameters` from `req.query`, `req.params`, and `req.headers` schemas
  (converted to JSON Schema via zod v4's `.toJSONSchema()` on the user's live
  schema instances). Path params are always `required`.
- `requestBody` from `req.body` as `application/json`.
- A default `200` response, until `route.output` lands.
- `ANY` endpoints are skipped with a warning.

## API

- `openapi({ outfile, title?, version? })` — CLI plugin factory. `run({ apps })`
  writes `JSON.stringify(doc, null, 2)` to `outfile` (resolved from `cwd`),
  merging paths across every app in `apps`.
- `swaggerUi({ doc, title?, uiPath?, specPath?, cdn? })` — builds an
  `HttpRouter` that serves the document as JSON (`/openapi.json`) and an
  interactive Swagger UI page (`/docs`). Compose it alongside your app's
  `serve()` router in the dev server.
