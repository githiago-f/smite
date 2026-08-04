---
title: Creating clients
summary: Generating a typed client for your API from the command line.
order: 10
---

`@smitejs/client` turns your server definition into a typed, builder-style
client. Every route you declare becomes a nested object with `$method` calls;
params come from the path template and are typed. There is no runtime codegen —
the client is generated once, at build time, and the emitted module is plain
TypeScript over a small fetch layer.

## The quick way: `smite generate client`

With the CLI installed, add a `smite.config.ts` to your project that lists the
`client()` plugin:

@example Configure the client plugin

Use `entries` to compile several serverless handler entries; the client merges
the routes from every app into one builder.

Then run `smite generate client`.

The CLI compiles your app in collect mode, runs it once to discover the
declared routes, and writes the client to `outfile`. Each entry must call
`http.app()` at module scope.

## The same flow, from code

If you do not want the config file, the engine is exported directly. This is
exactly what the CLI runs:

@example Create a client with the CLI

## The generated client

The emitted module exports `configure()` and an `api` builder that mirrors your
routes:

@example Generate a typed client

Call it like any typed function — `configure` sets the defaults, and each
`$method` takes a bucket with required params:

@example Call the generated client

## What you get

- One `$method` leaf per endpoint; dynamic `:param` segments become `$param`
  namespaces with required, typed params.
- `query`, `headers`, and `body` are loose optional buckets; `$config`
  overrides `configure()` per call.
- Responses are `{ status, body, headers }` and never throw on non-2xx.
- The generated file imports only `@smitejs/client/runtime` — no registry, no
  framework.

## See also

- `generated-api` for the builder shape in detail.
- `@smitejs/openapi`'s "Exposing OpenAPI" to serve a spec for the same app.
