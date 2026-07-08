---
title: Express Runtime
summary: Generate an Express-compatible runtime module from Smite descriptors.
order: 10
---

The Express runtime emitter turns merged HTTP descriptors into plain TypeScript source. It does not execute the application and it does not keep Smite abstractions in the final bundle.

Use it when you already have a validated controller descriptor and want to emit a runtime module that can be written into an Express application.

## Basic usage

@example Express runtime usage

The emitter returns the generated source together with the dependency keys it expects at runtime.
