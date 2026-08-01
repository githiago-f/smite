---
title: Express Runtime
summary: Bridge Express requests into the Smite HTTP execution pipeline.
order: 10
---

The Express runtime adapter turns Express requests into the Smite HTTP execution context, executes the core pipeline and serializes the result back to Express. Express owns route matching: each controller is mounted as its own Express router at its controller path.

Use `createExpressRuntime(...)` when you already have validated controller descriptors and want to mount them on an Express application.

`createExpressRuntime(...)` returns an Express Router that can be mounted with `app.use(...)`.

## Basic usage

@example Express runtime usage

`createExpressRuntime(...)` returns an Express Router that can be mounted with `app.use(...)`. Each controller becomes a router mounted at its own path, so multiple controllers produce multiple `app.use(path, controllerRouter)` mounts and route parameters are bound natively by Express.

## Request adaptation

`createExpressRuntime(...)` normalizes Express requests into the core HTTP execution context. When the Express request does not already expose parsed `req.cookies`, the adapter parses the `cookie` request header itself so `request.cookies` is always populated.

@example Express cookie adaptation
