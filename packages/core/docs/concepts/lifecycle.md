---
title: Lifecycle Composition
summary: Reusable execution policies built from lifecycle component builders.
order: 10
---

Lifecycle composition describes execution policy without describing transport behavior.
Guards, filters, providers, interceptors and pipes are all reusable builders. They are not classes and they are not runtime instances.

The lifecycle namespace creates small semantic descriptors. Those descriptors can be composed into policies and merged into transport descriptors during compilation.

## Why lifecycle is transport-agnostic

Lifecycle policy answers what execution concerns apply to a handler. It does not decide how HTTP, messaging or scheduled execution will run those concerns.

This keeps the public API reusable across transports and gives compiler plugins one normalized lifecycle model to consume.

@example Lifecycle adapters

## Reusable policies

A lifecycle composition can be declared once and applied to multiple controllers, routes or future transports.

@example Reusable lifecycle composition

## Compile-time merge

The compiler flattens controller-level, route-level and reusable lifecycle declarations before generating runtime code. No runtime merge is required.

@example Descriptor merging
