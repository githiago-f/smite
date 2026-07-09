---
title: Express Runtime
summary: Bridge Express requests into the Smite HTTP execution pipeline.
order: 10
---

The Express runtime adapter turns Express requests into the Smite HTTP execution context, executes the core pipeline and serializes the result back to Express.

Use `createExpressRuntime(...)` when you already have validated controller descriptors and want to mount them on an Express application.

`createExpressRuntime(...)` returns an Express-compatible request handler that can be mounted with `app.use(...)`.

## Basic usage

@example Express runtime usage

`createExpressRuntime(...)` returns an Express-compatible request handler that can be mounted with `app.use(...)`.
