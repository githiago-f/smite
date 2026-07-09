# Feature Request: Express Runtime Adapter

## Summary

Introduce an Express runtime adapter for Smite that bridges Express requests and responses into the core HTTP execution model.

The adapter should stay thin: it translates platform I/O into the core context/result shapes and delegates lifecycle ordering to the core.

The package should also expose a reusable `node:http` helper for environments that want the same core execution path without Express.

The proposed package name is:

```
@smite/express
```

---

## Motivation

Smite already separates intent from execution.

The core owns HTTP execution order and lifecycle merging. The runtime package should only adapt platform objects to that model.

Applications should not depend on Smite builders at runtime.

Instead, the compiled application should run against Express with the smallest possible bridge layer.

---

## Goals

* Adapt Express requests into the core HTTP execution context.
* Adapt core execution results back into Express responses.
* Keep lifecycle ordering in the core.
* Provide a reusable `node:http` helper.
* Keep the bridge thin and deterministic.

---

## Responsibilities

The runtime adapter is responsible for:

* translating `req`, `res`, `next`;
* resolving controller and route matches;
* serializing core results to Express;
* forwarding errors to Express when needed.

The runtime adapter is **not** responsible for:

* lifecycle ordering;
* descriptor merging;
* semantic graph construction;
* validation;
* source generation;
* infrastructure generation.

Those responsibilities belong elsewhere in the system.

---

## Core Boundary

The core owns the execution model:

```text
Controller Descriptor

+ Route Descriptor

+ Lifecycle Descriptor

↓

HttpExecutionContext

↓

HttpExecutionResult
```

The adapter only maps Express objects into that boundary and back out again.

---

## Output

The adapter should make an Express application behave like a Smite HTTP application.

Conceptually:

```text
Express Request

↓

Smite Core Execution

↓

Express Response
```

No runtime source generation is required for the example application.

---

## Helper Reuse

Some environments may prefer `node:http` instead of Express.

That helper can live alongside the Express adapter as a separate runtime bridge, but it should remain optional and reuse the same core execution path.
