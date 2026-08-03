---
title: Composition
summary: pipe, flow, and metadata that stays out of the way.
order: 10
---

`@smite/fp` gives you data-first, no-tax functional composition. `pipe` threads
a value through functions left to right; `flow` builds a reusable pipeline;
both leave introspection metadata attached without polluting the visible
object.

## pipe — thread a value

`pipe(value, ...fns)` applies each function to the previous result. Start with
the value, then the steps.

@example Pipe value transformation

## flow — build a reusable function

`flow(...fns)` returns a single composed function you can name, export, and
reuse. Steps run in order when the composed function is called.

@example Flow function composition

## identity, constant, noop

The trivial combinators round out the toolkit: `identity` returns its input,
`constant` returns a fixed value regardless of input, `noop` does nothing.

## Composition metadata

Composed functions carry a non-enumerable `compositionMetadata` symbol recording
each step's name and index. `getCompositionMetadata(fn)` reads it, so tooling can
inspect a pipeline without executing it — and normal `Object.keys`, spread, and
serialization never see the metadata.

@example Flow composition metadata