# Feature Request: Hoist Lifecycle Merging Out of the Per-Request Path

## Summary

Move `mergeLifecycleDescriptors` out of per-request execution and into runtime setup.

Today every HTTP request merges the controller and route lifecycle twice: once in
`executeHttpPipeline` and again inside `executePipeline`. The merged policy is
request-invariant — the descriptors it combines are frozen at build time — so the
merge is pure redundant work on the hot path.

The change precomputes each merged lifecycle once, at the moment a controller is
mounted or a pipeline target is created, and reuses it for every request.

---

## Motivation

The k6 benchmark (50 VUs, 30s) shows the Smite Express runtime at 7,741 req/s vs
8,168 req/s for a plain Express twin: **-5.2%**. The diagnostic ranked the
per-request lifecycle merge as the largest systematic overhead:

* `executeHttpPipeline` calls `mergeLifecycleDescriptors(controller.lifecycle, route.lifecycle)` on every request (`packages/core/src/transport/execute.ts:149-151`).
* `executePipeline` then calls `mergeLifecycleDescriptors(target.lifecycle)` again on the already-merged composition (`packages/core/src/transport/execute.ts:74`).
* Each call allocates a new `entries` array and runs `freeze`/`freezeArray` (`packages/core/src/lifecycle/merge.ts:25-45`).

The result is identical on every request. Builders already freeze the inputs:
`lifecycle.create()` and every `.guards()`/`.use()` return frozen compositions
(`packages/core/src/lifecycle/lifecycle.ts:191-208`), and controllers and routes
store frozen compositions (`packages/core/src/transport/http.ts:54,204`). The
framework is compile-time-first; work that only depends on descriptors should
happen once, before the request loop.

---

## Goals

* Zero `mergeLifecycleDescriptors` calls inside `executePipeline` or `executeHttpPipeline` on the per-request path.
* Merged policies are computed once per controller mount and once per pipeline target.
* No change to the public API contract; existing callers keep working unchanged.
* Same semantic ordering: controller entries followed by route entries, per `mergeLifecycleDescriptors`.
* Measured improvement on the `benchmarks/` k6 run, with p50/p90 no worse after the change.

---

## Implementation Plan

The steps are ordered by importance. Complete them in order; each step leaves the workspace green.

### Step 1 — Make `executePipeline` skip re-merging a composition

`executePipeline` accepts a `LifecycleSource`, which may be a frozen composition,
a single entry builder, or a raw entry. Merging is only needed for non-composition
sources.

Concrete changes in `packages/core/src/transport/execute.ts`:

* When `target.lifecycle` is already a `LifecycleCompositionDescriptor` (after
  unwrapping a `{ descriptor }` builder), use its `entries` directly and do not
  call `mergeLifecycleDescriptors`.
* Keep the merge branch for raw entry sources so direct callers (tests, ad-hoc
  targets) remain correct.

This alone removes the inner merge of the current double-merge. Verify:

```
yarn workspace @smite/core test
```

`executePipeline` tests in `handleify.test.ts:215` and `execute.test.ts` cover both
composition and raw sources.

### Step 2 — Pre-merge once per pipeline target

`createPipelineTarget` (`packages/core/src/transport/handleify.ts:150-161`) runs
once per consumer or job at `handleify` time, but stores the raw lifecycle source.
Merge there instead:

* `createPipelineTarget` calls `mergeLifecycleDescriptors(descriptor.lifecycle)` once and stores the composition.
* Combined with Step 1, messaging and scheduler paths then allocate nothing per message or per cron run.

Verify: `yarn workspace @smite/core test`; `handleify.test.ts` consumer/job cases assert behavior unchanged.

### Step 3 — Pre-merge HTTP routes at mount time

HTTP is the hot path in the benchmark. The per-request merge in
`executeHttpPipeline` must move to setup:

* `handleify.handleController` already compiles routes once
  (`packages/core/src/transport/handleify.ts:130-148`). Extend `CompiledRoute`
  (`handleify.ts:163-168`) with a `lifecycle` field holding
  `mergeLifecycleDescriptors(controller.lifecycle, route.lifecycle)`, computed in
  `compileRoute`.
* `executeHttpPipeline` gains an optional precomputed lifecycle parameter; when
  provided it skips merging and passes the composition straight to `executePipeline`
  (which, after Step 1, uses its entries directly).
* `handleController` passes the compiled route's precomputed lifecycle, so matched
  requests allocate nothing for the merge.

Verify: `yarn workspace @smite/core test`; `http.test.ts:218` extractor cases and
`execute.test.ts:5` pipeline cases pass unchanged.

### Step 4 — Hoist in the Express runtime

The Express adapter calls `executeHttpPipeline` directly from its route middleware,
so it must precompute the merge at setup rather than per request.

Concrete changes in `packages/express/src/runtime.ts`:

* In `createRouteMiddleware` / router mounting, compute
  `mergeLifecycleDescriptors(controller.lifecycle, route.lifecycle)` once per route
  and capture it in the middleware closure.
* Pass the precomputed composition to `executeHttpPipeline` for every request.
* If any router-less or serverless code path still needs merging, route it through
  the Step 3 API so the merge stays at setup.

Verify: `yarn workspace @smite/express test`; existing runtime route tests
(`runtime.test.ts`) pass with no behavioral change.

### Step 5 — Benchmark before and after

Use the delegated k6 harness already in the repository:

```
sg docker -c 'docker compose -f benchmarks/docker-compose.yml up --build --abort-on-container-exit'
sg docker -c 'docker compose -f benchmarks/docker-compose.yml run k6 compare'
```

Compare against the recorded baseline (50 VUs, 30s): express 8,168 req/s,
smite 7,741 req/s (-5.2%). Acceptance: the gap narrows and p50/p90 do not regress.

---

## Success Criteria

* No `mergeLifecycleDescriptors` call executes on the per-request path.
* Controllers, consumers and jobs each merge their lifecycle once at setup.
* `@smite/core` and `@smite/express` test suites pass unchanged.
* The k6 smite throughput gap versus plain Express narrows relative to -5.2%, with no p50/p90 regression.
* No new runtime dependency or architecture change; descriptors remain frozen and immutable.
