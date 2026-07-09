# Feature Request — `@smite/fp`

## Summary

Introduce a lightweight functional programming module for Smite.

The goal is **not** to build a full functional runtime like Effect or fp-ts. Instead, the library should provide a minimal set of composable primitives that encourage pure functional development while integrating naturally with Smite's compile-time architecture and Semantic Registry.

This package should become the preferred foundation for implementing both the framework itself and user applications.

---

# Goals

* Encourage pure functional composition.
* Eliminate exception-driven control flow.
* Minimize nullable values.
* Make pipelines self-describing.
* Remain extremely small.
* Produce zero or near-zero runtime overhead.
* Integrate with the Semantic Registry.
* Preserve excellent TypeScript inference.

---

# Non-Goals

The library is **not** intended to become:

* Effect
* fp-ts
* Cats
* ZIO
* Arrow

Specifically, it should not include:

* Effect runtimes
* Fibers
* Dependency injection containers
* Schedulers
* Layers
* Readers
* Writers
* State monads
* Free monads
* Complex higher-kinded abstractions

The focus is practical functional programming for application development.

---

# Design Principles

## Small Surface Area

Every exported primitive should solve a common problem.

If a primitive is rarely needed, it should not exist.

The library should remain approachable for developers without previous FP experience.

---

## Composition First

The API should encourage composing small operations rather than building large imperative functions.

Example:

```ts
const createUser = flow(
    validate,
    normalize,
    persist,
);
```

---

## Method Chaining over Object Literals

Smite should avoid object-literal APIs whenever possible.

Configuration should be expressed through fluent chains.

Preferred:

```ts
Result.ok(user)
    .map(validate)
    .flatMap(save)
    .tap(log);
```

Instead of:

```ts
match(result, {
    ok: ...,
    err: ...
});
```

Likewise:

```ts
Matcher
    .from(result)
    .ok(...)
    .err(...)
    .run();
```

Instead of callback objects.

This guideline should apply consistently throughout the library.

---

## Strong Type Inference

Developers should rarely need explicit generic annotations.

Types should naturally propagate across composed operations.

---

## Lazy Evaluation

Expensive operations should only execute when explicitly requested.

Primitives representing asynchronous work should be lazy by default.

---

## Framework Friendly

Every primitive should be compatible with Smite's compile-time architecture.

Whenever possible, composition metadata should be available for the Semantic Registry without affecting runtime execution.

---

# Proposed Modules

## pipe

Sequential value transformation.

```ts
pipe(
    input,
    validate,
    normalize,
    persist,
);
```

---

## flow

Function composition.

```ts
const createUser = flow(
    validate,
    normalize,
    persist,
);
```

---

## Option

Represents optional values without relying on `null` or `undefined`.

Example API:

```ts
Option
    .some(user)
    .map(...)
    .filter(...)
    .unwrapOr(defaultUser);
```

---

## Either

Represents two possible outcomes.

Example API:

```ts
Either
    .right(user)
    .map(...)
    .flatMap(...)
    .mapLeft(...);
```

---

## Result

Represents success or failure.

Preferred for application code.

Example:

```ts
Result
    .ok(user)
    .map(...)
    .flatMap(...)
    .recover(...)
    .tap(...);
```

---

## Task

Represents lazy asynchronous computation.

```ts
Task
    .from(asyncOperation)
    .map(...)
    .flatMap(...)
    .run();
```

---

## TaskResult

Represents asynchronous operations that may fail.

Instead of:

```ts
Promise<Result<T>>
```

Developers use:

```ts
TaskResult<T>
```

Supporting:

* map
* flatMap
* recover
* tap
* run

---

## Match

Pattern matching through fluent APIs.

Preferred:

```ts
Matcher
    .from(result)
    .ok(...)
    .err(...)
    .run();
```

Avoid callback object literals.

---

## Predicate

Composable predicates.

Examples:

```ts
and(...)
or(...)
not(...)

isString
isNumber
isUUID
isEmpty
```

---

## Function Utilities

Minimal helper utilities.

Examples:

* identity
* constant
* noop

No large utility collection should be introduced.

---

# Integration with the Semantic Registry

The library should expose composition metadata whenever possible.

Example:

```ts
const createUser = flow(
    validate,
    normalize,
    persist,
);
```

The compiler should be able to infer a composition graph similar to:

```text
createUser
    ├── validate
    ├── normalize
    └── persist
```

This metadata should be available during compilation only.

The runtime should not depend on the Semantic Registry.

---

# Future Opportunities

Once composition graphs become available, compiler plugins may generate:

* execution diagrams
* architecture documentation
* dependency graphs
* validation reports
* optimization hints

without requiring additional developer annotations.

---

# Success Criteria

The feature will be considered successful if:

* developers naturally write smaller pure functions;
* exception-driven flow control becomes uncommon;
* nullable values are significantly reduced;
* fluent composition becomes the default programming style;
* the API remains small and easy to learn;
* runtime overhead remains negligible;
* composition metadata can be consumed during compilation without leaking into production bundles.

