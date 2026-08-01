---
title: Handleify
summary: Turn transport descriptors into plain runtime functions.
order: 40
---

Handleify turns any transport descriptor — a controller, a scheduler job or a messaging consumer — into a plain function that runs its middlewares and dispatches its handler.

The runtime process is owned by the core. Transport runtimes stay thin: they only adapt platform I/O to the context shape and delegate execution to handleified functions.

## How it works

A descriptor carries a lifecycle composition and a handler reference. `handleify` returns a transport-shaped function:

- controller → `(request) => result`
- messaging consumer → `(message) => result`
- scheduler job → `() => result`

Every returned function runs providers, guards, pipes and interceptors in core order, then dispatches the handler. A guard that denies skips the handler: controllers receive a `403` result, while consumers and jobs resolve to `undefined`.

## Controllers

A handleified controller matches the request to a route, merges the controller and route lifecycle, and dispatches the handler. Requests that match no route resolve to a `404` result.

@example Handleify a controller

## Messaging consumers

A handleified consumer runs its lifecycle and dispatches the handler with the message as context input.

@example Handleify a messaging consumer

## Scheduler jobs

A handleified job runs its lifecycle and dispatches the handler with no input.

@example Handleify a scheduler job

## The generic pipeline

The same execution engine is exposed as `executePipeline` for custom contexts that are not covered by a transport builder.

@example Execute a pipeline
