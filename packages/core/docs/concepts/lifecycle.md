---
title: Lifecycle Composition
summary: Reusable execution policies built from lifecycle component builders.
order: 10
---

Lifecycle composition describes execution policy without describing transport behavior.
Guards, filters, providers, interceptors and pipes are all reusable builders. They are not classes and builders never execute runtime logic.

The lifecycle namespace creates small semantic descriptors. Those descriptors can be composed into policies and merged into transport descriptors during compilation. A descriptor may also reference a runtime implementation, such as a validator that calls a schema parser or a filter that localizes captured errors.

## Why lifecycle is transport-agnostic

Lifecycle policy answers what execution concerns apply to a handler. It does not decide how HTTP, messaging or scheduled execution will run those concerns.

This keeps the public API reusable across transports and gives compiler plugins one normalized lifecycle model to consume.

@example Lifecycle adapters

## Runtime implementations

Lifecycle implementations are explicit function references carried by the descriptor. They are consumed by generated runtime artifacts, not executed by the builder layer.

@example Lifecycle implementations

## Reusable policies

A lifecycle composition can be declared once and applied to multiple controllers, routes or future transports.

@example Reusable lifecycle composition

## Compile-time merge

The compiler flattens controller-level, route-level and reusable lifecycle declarations before generating runtime code. No runtime merge is required.

@example Descriptor merging
