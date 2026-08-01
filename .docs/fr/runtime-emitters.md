# Feature Request: Platform-Native Routing and Runtime Emitters

## Summary

Two related changes move routing and wiring out of hand-written adapters:

1. Delegate HTTP routing to the platform. The Express adapter stops matching routes itself and instead mounts each controller as a native Express router via `app.use(path, router)`. Express owns method matching, path parameters and prefix mounts; the adapter only translates request and response objects.
2. Introduce runtime emitters: compile-time generators that turn merged descriptors into the platform wiring that runs them — Express mounts, message subscriptions and cron registrations.

---

## Motivation

The Express adapter currently re-implements route matching (`findRoute`), duplicating Express's own router and diverging from it (path parameters did not route correctly).

Per the architecture, a runtime bridge should only translate platform objects into the core execution context and result shapes. Lifecycle ordering and execution belong to the core; routing belongs to the platform that is purpose-built for it.

The framework is also compile-time-first. Wiring that can be generated from descriptors should be generated, not written by hand.

---

## Goals

* Express owns HTTP routing; the adapter only translates.
* Multiple controllers result in multiple `app.use(path, controllerHandler)` mounts.
* `handleify` retains its regex router for router-less contexts (serverless, tests, messages, cron).
* A runtime emitter contract consumes merged descriptors and emits platform runtime source.
* Emitters are deterministic, isolated and compile-time only, with zero runtime footprint.

---

## Implementation Plan

The steps are ordered by importance. Complete them in order; each step leaves the workspace green.

### Step 1 — Delegate HTTP routing to Express

The most important step. It fixes a correctness bug and establishes the principle that the platform owns routing.

Concrete changes:

* Build one Express `Router()` per controller; register every route natively (`router.get("/:profileId", routeMiddleware)`, `router.post("/", routeMiddleware)`, and so on).
* Mount each router at its controller path: `app.use(controller.path, controllerRouter)`.
* `routeMiddleware` is pure translation:
  * build `HttpExecutionContext` from `req` — Express has already parsed method, path, parameters and query;
  * call `executeHttpPipeline(controller, route, context)`;
  * write the returned `HttpExecutionResult` to `res`.
* Remove `findRoute`, `normalizePath` and the adapter-owned 404 response from `@smite/express`. Unmatched requests fall through to Express's default 404.
* `createExpressRuntime` returns a mountable Express router instead of a single middleware, so `app.use(createExpressRuntime({ controllers }))` keeps working.

Files: `packages/express/src/runtime.ts`, `packages/express/src/types.ts`, `packages/express/src/runtime.test.ts`.

Verify: `yarn workspace @smite/express test`; route tests cover `/users/:profileId` and assert real path parameters.

### Step 2 — Define the runtime emitter contract

Emitters consume merged semantic descriptors — never application source — and produce platform-native runtime source. They are compile-time plugins: deterministic, isolated and free of runtime dependencies.

The contract:

* Input: normalized descriptors (controller, messaging consumer, scheduler job) with merged lifecycle policy.
* Output: generated wiring source that imports `handleify` and `executeHttpPipeline` alongside the merged descriptors.
* One generated artifact per transport:
  * HTTP — router construction, native route registration and `app.use(path, router)`.
  * Messaging — `queue.subscribe((message) => handleify(consumer)(message))`.
  * Scheduler — registration wiring that invokes `handleify(job)(cronEvent)`.

This step defines the types and shapes only. It is the design boundary every emitter implements.

### Step 3 — Implement the Express runtime emitter

The first concrete emitter. It reads controllers from the descriptor model and emits the bootstrap that Step 1 showed by hand:

* import the merged controller descriptors;
* build one router per controller;
* register each route with the translation middleware;
* mount each router: `app.use(path, router)`.

The emitter lives outside `@smite/core` as an extension and disappears after generation.

Verify: generating from a small set of controllers produces wiring that behaves identically to the hand-written runtime.

### Step 4 — Extend emitters to messaging and scheduler

Completes the goal of telling the runtime what to build for handling messages:

* message consumers emit subscription wiring that calls `handleify(consumer)` for each received message;
* scheduled jobs emit registration wiring that calls `handleify(job)` with a `CronEvent`.

Both reuse core execution; emitters only generate the platform glue around it.

### Step 5 — Add compile-time validation and diagnostics

The emitter, or a sibling plugin, validates semantics during compilation:

* duplicate route registrations;
* conflicting controller paths;
* missing handlers;
* unsupported route patterns.

Diagnostics are deterministic, identify the offending node and suggest a correction.

### Step 6 — Reconcile documentation

* Update `express-runtime.md`: the adapter no longer resolves route matches.
* Document runtime emitters as an extension point in `extensibility.md`.
* Add concept docs for the emitter-generated wiring.

---

## Success Criteria

* `@smite/express` performs no path matching; Express routes natively.
* Controllers mount as `app.use(path, router)`; multiple controllers produce multiple mounts.
* Path parameters route correctly through Express.
* A runtime emitter generates Express wiring from descriptors.
* Messaging and scheduler emitters generate subscriptions and registrations.
* Emitters are compile-time only and leave no runtime footprint.
* The whole workspace stays green after each step.
