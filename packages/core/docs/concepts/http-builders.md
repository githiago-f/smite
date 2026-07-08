---
title: HTTP Builders
summary: Functional builders for HTTP controllers and routes.
order: 20
---

HTTP builders describe transport intent as immutable metadata. They do not start a server, register handlers globally or construct runtime pipelines.

Controllers group routes under a path. Routes carry method, path, handler reference and route-specific lifecycle policy.

## Controllers

Controllers are ordinary values. They can be exported from any module and discovered by the compiler without a mandatory application object.

@example HTTP controller with lifecycle

## Route policy

Routes can also apply lifecycle builders directly. The compiler later merges route policy with controller policy.

@example Route-specific lifecycle

## Custom lifecycle handlers

Controller and route lifecycle descriptors may reference runtime implementations such as validators and error filters. The compiler preserves those references for generated runtimes.

@example HTTP controller with custom lifecycle implementations

## Immutability

Each builder call returns a new builder. This makes shared base descriptors safe to reuse across modules.

@example Immutable builder derivation
