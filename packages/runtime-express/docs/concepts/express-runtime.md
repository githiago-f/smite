---
title: Express Runtime
summary: Bridge Express requests into the Smite HTTP execution pipeline.
order: 10
---

The Express runtime adapter turns Express requests into the Smite HTTP execution context, executes the core pipeline and serializes the result back to Express.

Use it when you already have validated controller descriptors and want to wire them into an Express application.

The package also exposes a `node:http` helper for environments that want to reuse the same core execution path without Express.

## Basic usage

@example Express runtime usage

The adapter returns an Express-compatible request handler that can be mounted on an app.
