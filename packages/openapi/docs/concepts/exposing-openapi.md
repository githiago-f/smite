---
title: Exposing OpenAPI
summary: Generating an OpenAPI document and browsing it with Swagger UI.
order: 10
---

`@smitejs/openapi` describes your app the way a spec describes an API: it walks
the compiled routes and emits an OpenAPI 3.1 document. Because the generator
runs against your app's live schemas, the `req` buckets you declared (`query`,
`params`, `headers`, `body`) become accurate parameters and request bodies —
no hand-written spec to keep in sync.

## Generate the document

Add the `openapi()` plugin to your `smite.config.ts`:

@example Configure the openapi plugin

Then run `smite generate openapi`. With several serverless handler entries,
list them all in `entries` — the document merges paths from every app into one
spec.

This writes a JSON document with one `paths` entry per endpoint. `:param`
segments become `{param}` templates, bucket schemas become `parameters` /
`requestBody`, and `ANY` endpoints are skipped with a warning.

Beyond the routes, pass root-level OpenAPI configuration to `openapi()` — for
example `servers` to point the document at a deployed host, or
`securitySchemes` plus `security` to declare API-key auth:

@example Configure root-level OpenAPI options

Any of `servers`, `security`, `securitySchemes` (emitted under
`components.securitySchemes`), `tags`, `externalDocs`, or the catch-all
`additional` object is merged verbatim into the emitted document.

@example Generate an OpenAPI document

## Browse it with Swagger UI

The generator ships a router that serves the document and an interactive UI, so
you can explore and try your endpoints in the browser:

@example Serve the OpenAPI document

The router responds to:

- `GET /openapi.json` — the raw document as JSON.
- `GET /docs` — the Swagger UI page (assets loaded from a CDN by default;
  override with the `cdn` option to self-host).

Compose it next to your app's `serve()` router so `/docs` and `/openapi.json`
route to the UI while everything else goes to your API:

@example Compose Swagger UI with the app router

## What is emitted

- One OAS path per endpoint template (`/users/:id` → `/users/{id}`).
- `parameters` from `req.query` / `req.params` / `req.headers` schemas; path
  params are always `required`.
- `requestBody` from `req.body` as `application/json`.
- A default `200` response until response schemas land.

## See also

- `@smitejs/client`'s "Creating clients" to generate a typed client for the same
  app.
