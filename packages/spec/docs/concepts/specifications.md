---
title: Specifications
summary: Compile-time projections that turn Smite HTTP descriptors into Express wiring and PlantUML diagrams.
order: 10
---

Specifications are compile-time projections of the Semantic Graph. They consume
the same HTTP descriptors that a runtime would execute and render a deterministic
artifact without running the application. The two canonical targets are Express
(wiring specification) and PlantUML (documentation diagram).

## Express specification

`renderExpressSpec(...)` renders the platform-native Express wiring: one router
per controller, mounted at its controller path, every route registered natively,
and each route's merged lifecycle in core execution order. Filters are marked as
error-only.

@example Express specification

## PlantUML specification

`renderPlantUml(...)` renders a component diagram. Each controller becomes a
component with one nested component per route; merged lifecycle entries become
separate components with edges in execution order, and filters are drawn as
error-only edges.

@example PlantUML specification

## Generating from the CLI

The `scripts/spec.mjs` script reads a compiled application entry (a module that
exports `controllers`) and writes both specifications to an output directory:

```
node scripts/spec.mjs examples/http/dist/components.js examples/http/spec
```

This produces `express.spec.md` and `plantuml.puml` for the application. See
`examples/http/spec/` for the generated output of the canonical example.
