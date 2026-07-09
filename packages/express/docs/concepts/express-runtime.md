---
title: Express Runtime
summary: Bridge Express requests into the Smite HTTP execution pipeline.
order: 10
---

The Express runtime adapter turns Express requests into the Smite HTTP execution context, executes the core pipeline and serializes the result back to Express. Express owns route matching: each controller is mounted as its own Express router at its controller path.

`createExpressRuntime(...)` returns an Express-compatible request handler that can be mounted with `app.use(...)`.

See the HTTP builders documentation in `@smite/core` for the full controller, route, lifecycle and schema API used before the runtime runs.

## Controller with lifecycle

Controllers apply reusable lifecycle policy to groups of routes. Lifecycle components (guards, pipes, filters, interceptors, providers) are transport-agnostic builders from `@smite/core`.

@example Express runtime usage

## Denied guards

When a guard returns `false`, the pipeline short-circuits with a `403` response before the handler runs.

@example open circuit with guards

## Route-specific lifecycle

Routes can also apply lifecycle builders directly. The runtime merges route policy with controller policy.

@example Route-specific lifecycle

## Reusable compositions

Lifecycle compositions can be declared once and applied to multiple controllers without duplication.

@example Reusable lifecycle composition

## Immutability

Each builder call returns a new builder. Shared base descriptors are safe to reuse across routes.

@example Immutable builder derivation

## Input schemas

Schemas attached with `.input()` auto-generate validation lifecycle entries. Any object with a `.parse()` method works.

@example Route input schema

## Output schemas

Output schemas map status codes to response body shapes. They are consumed by artifact generators (OpenAPI, SDKs) and have no runtime effect.

@example Route output schema

## Reusable specs

A route spec bundles input and output schemas into a reusable contract. Multiple routes can extend the same spec.

@example Route spec extend

## HttpResult

Return `http.result(status, body)` for a structured result the pipeline normalises directly.

@example HttpResult from handler

## Result conversion

The runtime unwraps `@smite/fp` `Result` values automatically.

@example Result ok to HTTP

@example Result err to HTTP

When a handler returns `Result.err` with a non-numeric error (single-arg form), the runtime falls back to a `500` response.
