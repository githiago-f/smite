---
title: Example applications
summary: Runnable projects you can copy and adapt.
order: 70
---

The `examples/` directory holds complete, runnable applications built on
`@smite/*`. Each is a small standalone package you can start and hit with
`curl` or a browser.

## A REST server over node:http

`examples/http-rest-server` defines an app with validated params and query,
serves it through the built-in `node:http` adapter, and prints curl commands.
Start it with `yarn workspace @smite/example-http-rest-server start`, then:

- `GET /users/42` responds `{"id":42}`.
- `GET /users/7/posts/9` responds `{"id":7,"postId":9}`.
- `GET /users?q=hi` responds `{"q":"hi"}`.

## Env-driven HTTP server

`examples/env-http` wires `@smite/env` into a server: declared variables
(`PORT`, `GREETING`) are resolved through a provider and injected into the
handler. Start it with `yarn workspace @smite/example-env-http start`.

## Typed client + server

`examples/typed-client` defines an app, generates a typed client with
`@smite/client`, and calls it back over HTTP. Build the client with
`yarn workspace @smite/example-typed-client build`, start the server with
`start:server`, then run the client with `start:client`.

## CLI-driven codegen + Swagger UI

`examples/cli-app` is the full CLI flow: a `smite.config.ts` declares the
`client()` and `openapi()` plugins, `yarn workspace @smite/example-cli-app
generate` runs both generators, and `start` serves the app plus an interactive
Swagger UI (`/docs`) and the raw spec (`/openapi.json`).

## Functional utilities

`examples/fp-utils` exercises `@smite/fp` — `Option`, `Result`, `Task`,
`TaskResult`, `chain`, and `flow` — in a small request-handling script. Start it
with `yarn workspace @smite/example-fp-utils start`.

The benchmark harness under `benchmarks/` consumes the same route shape; see
`benchmarking` for how the routing numbers are produced.