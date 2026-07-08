
# Feature Request: Functional Lifecycle Composition & Transport Builders

## Summary

Redesign the developer-facing application API around **functional transport builders** and **reusable lifecycle compositions**, replacing traditional application bootstrap patterns and dependency injection containers.

This proposal aligns with Smite's compile-time-first philosophy by making every builder produce immutable descriptors that can be merged during compilation and completely removed from the runtime bundle.

---

# Motivation

The current direction still resembles traditional frameworks by encouraging an application-centric bootstrap.

Instead, Smite should treat applications as collections of descriptors discovered during compilation.

There should be no mandatory `Application`, `Bootstrap`, or `main.ts`.

A project may expose a single HTTP endpoint or hundreds of modules using exactly the same programming model.

The framework should favor composition over inheritance and descriptor merging over runtime dependency injection.

---

# Goals

* Remove the concept of a mandatory application object.
* Introduce transport-specific builders.
* Introduce reusable lifecycle compositions.
* Make lifecycle configuration reusable across transports.
* Keep every builder immutable.
* Preserve zero-cost runtime abstractions.
* Improve API discoverability through namespaces.
* Maximize tree-shaking opportunities.

---

# Transport Builders

Each transport exposes its own DSL.

Examples include:

* `http`
* `messaging`
* `scheduler`

Each namespace owns only concepts related to its transport.

Example:

```ts
http.controller()

http.route.get(...)
http.route.post(...)
```

Future transports may expose their own builders without affecting the core architecture.

---

# Lifecycle Composition

Introduce a transport-agnostic lifecycle builder responsible for execution concerns.

Example:

```ts
const authenticated = lifecycle
    .create()
    .guards(JwtGuard)
    .filters(HttpErrorsFilter)
    .providers(
        AuthProvider,
        LoggerProvider,
    );
```

The lifecycle builder does not define transport behavior.

It only defines reusable execution policies.

---

# Applying Lifecycle Configurations

Transport builders should consume lifecycle compositions.

Example:

```ts
export const UsersController = http
    .controller()
    .use(authenticated)
    .path("/users")
    .routes(
        http.route.get("/", listUsers),
        http.route.post("/", createUser),
    );
```

The same lifecycle configuration should also be reusable by other transports.

Example:

```ts
export const BillingConsumer = messaging
    .consumer()
    .use(authenticated)
    .queue("billing-events")
    .handler(processBilling);
```

---

# Functional Composition

Every builder must be immutable.

Every configuration call returns a new descriptor.

Example:

```ts
const api = http
    .controller()
    .guards(JwtGuard)
    .filters(HttpErrorsFilter);
```

Later:

```ts
const users = api.path("/users");
```

No builder may mutate previous instances.

---

# Descriptor Merging

Lifecycle builders and transport builders should remain independent.

During compilation, the compiler merges their descriptors into a single semantic representation.

Example:

```text
Lifecycle Descriptor
        +
Controller Descriptor
        +
Route Descriptor
        ↓
Merged Descriptor
        ↓
Generated Runtime Pipeline
```

No runtime merge should occur.

---

# Variadic Builder APIs

Collection-based configuration should use variadic arguments instead of arrays whenever possible.

Preferred:

```ts
.providers(
    UserProvider,
    ClockProvider,
)
```

Instead of:

```ts
.providers([
    UserProvider,
    ClockProvider,
])
```

The same rule applies to:

* guards
* filters
* providers
* interceptors
* pipes
* routes
* modules

This improves readability and TypeScript inference.

---

# Lifecycle Adapters

Lifecycle concerns should remain explicit.

Components should be adapted into lifecycle descriptors before composition.

Example:

```ts
lifecycle.guard(JwtGuard)

lifecycle.filter(HttpErrorsFilter)

lifecycle.interceptor(LoggerInterceptor)

lifecycle.pipe(ValidationPipe)
```

Transport builders consume lifecycle descriptors instead of raw implementation objects.

This preserves descriptor consistency across transports.

---

# Pipeline Generation

The compiler should compose the final execution pipeline during build time.

Conceptually:

```text
Middleware
↓

Guard
↓

Pipe
↓

Interceptor (before)
↓

Handler
↓

Interceptor (after)
↓

Exception Filter
```

The emitted runtime should contain a single optimized execution function.

No runtime pipeline construction should remain.

---

# Design Principles

The implementation must preserve the following principles:

* compile-time first
* immutable builders
* descriptor-first architecture
* functional composition
* reusable lifecycle definitions
* transport independence
* zero-cost abstractions
* deterministic compilation
* descriptor merging during compilation
* no runtime dependency injection container

---

# Expected Benefits

* Simpler developer experience.
* Reusable lifecycle configurations.
* Smaller generated runtime.
* Better separation between transports and execution policies.
* Easier plugin development.
* Improved static analysis.
* Better tree-shaking.
* Consistent API surface across all transports.

---

# Non-Goals

This proposal does **not** introduce:

* runtime reflection
* decorators
* class-based controllers
* dependency injection containers
* mandatory application bootstrap
* runtime descriptor merging

---

# Documentation Updates

The implementation of this feature **must** include updates to every affected document to keep the architecture and developer guidance consistent.

At minimum, update:

* `README.md`

  * Present the new builder philosophy with an updated quick-start example.

* `AGENTS.md`

  * Reflect the new architectural model and lifecycle composition approach.

* `docs/architecture.md`

  * Document transport builders, lifecycle builders, descriptor merging, and immutable composition.

* `docs/extensibility.md`

  * Explain how plugins can consume lifecycle descriptors and merged transport descriptors.

* `docs/plugin-system.md`

  * Describe how compiler plugins receive merged descriptors instead of transport-specific runtime objects.

* `docs/harness.md`

  * Update engineering heuristics to prefer lifecycle composition over runtime injection.

* `docs/contributing.md`

  * Document conventions for implementing new builders and lifecycle components.

* Every affected `SKILL.md`

  * Update examples, terminology, and engineering guidance to match the new API.

All documentation examples must be updated to use the new builder model. No obsolete bootstrap or application-based examples should remain.
