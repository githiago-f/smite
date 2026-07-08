
# Feature Request: Runtime Emitter Plugin Architecture

## Summary

Introduce the first runtime emitter plugin for Smite, initially targeting Express.

The plugin should consume Smite descriptors and generate a fully executable Express-compatible runtime without requiring runtime framework dependencies, runtime reflection, or build-time integration inside the generated application.

The generated output should be equivalent to hand-written Express code and preserve maximum tree-shaking opportunities.

The proposed package name is:

```
@smitejs/runtime-express
```

This naming establishes a scalable convention for future runtime targets such as Fastify, Hono, Cloudflare Workers, AWS Lambda, Bun, Node.js and others.

---

# Motivation

Smite's compiler already separates application intent from runtime execution.

The runtime plugin should be responsible only for transforming semantic descriptors into executable code for a specific platform.

Applications should never execute Smite builders at runtime.

Instead, the compiler emits plain platform-native code.

For Express, this means generating Express handlers and routers that contain only business logic and the minimal runtime composition required.

---

# Goals

* Generate native Express runtime code.
* Avoid runtime framework abstractions.
* Avoid runtime descriptor processing.
* Preserve tree-shaking.
* Produce platform-native output.
* Keep runtime independent from compiler infrastructure.
* Allow future runtime emitters to follow the same architecture.

---

# Responsibilities

The runtime emitter is responsible for:

* consuming merged descriptors
* composing lifecycle pipelines
* generating Express routers
* generating middleware composition
* generating provider initialization
* generating route registration
* generating runtime entrypoints

The runtime emitter is **not** responsible for:

* descriptor discovery
* semantic graph construction
* dependency analysis
* validation
* compilation
* infrastructure generation

Those responsibilities belong to the compiler.

---

# Input

The runtime emitter receives fully validated semantic descriptors produced by the compiler.

Conceptually:

```text
Semantic Graph

↓

Merged Descriptors

↓

Runtime Emitter
```

The runtime emitter should never inspect source code.

It only consumes descriptors.

---

# Output

The emitter should generate native Express code equivalent to what an experienced developer would manually write.

Example conceptually:

```text
Controller Descriptor

↓

Express Router

↓

Express Application
```

No Smite runtime objects should remain.

---

# Runtime Philosophy

The generated application must not depend on Smite builders.

After generation, Smite should disappear from the runtime.

The generated project should be executable using only Express and the application's own business logic.

Example:

```text
Application Source

↓

Smite Compiler

↓

Express Runtime

↓

Node.js
```

There should be no runtime descriptor resolution.

No runtime graph traversal.

No runtime compilation.

---

# Lifecycle Composition

The runtime emitter should receive already merged lifecycle descriptors.

Example:

```text
Controller

+

Lifecycle

+

Routes

↓

Merged Descriptor

↓

Express Middleware Chain
```

The runtime emitter should only translate descriptors into executable code.

When an executable adapter is needed, it should translate platform request and response objects into the core execution model and delegate lifecycle ordering to the core.

---

# Generated Pipeline

Conceptually:

```text
Express Request

↓

Generated Middleware

↓

Generated Guards

↓

Generated Pipes

↓

Generated Interceptors

↓

Business Handler

↓

Generated Filters

↓

Express Response
```

The pipeline should be generated during compilation.

No runtime composition should occur.

---

# Tree-Shaking

Generated code should maximize tree-shaking opportunities.

Requirements:

* static imports only
* no dynamic runtime discovery
* no reflection
* no metadata inspection
* no runtime registries
* no dependency injection container

Unused lifecycle components should be removable by the bundler.

---

# Platform Independence

The runtime emitter must not introduce Express concepts into Smite's core abstractions.

Smite descriptors remain transport-agnostic.

Only the emitter knows how to translate them.

Future emitters should be able to consume the same descriptors.

Examples:

```
@smite/runtime-fastify

@smite/runtime-hono

@smite/runtime-lambda

@smite/runtime-cloudflare

@smite/runtime-node
```

No descriptor changes should be required when targeting a different runtime.

---

# Code Generation Strategy

The emitter should generate plain TypeScript modules.

Generated code should resemble production-quality handwritten code.

Avoid generic runtime wrappers whenever possible.

Prefer direct function composition.

---

# Success Criteria

The feature is complete when:

* Smite applications can target Express without runtime builders.
* Generated code contains only Express-compatible runtime logic.
* Smite descriptors are fully eliminated from the runtime bundle.
* Tree-shaking removes every unused component.
* Generated output is readable and maintainable.
* The architecture is reusable by future runtime emitters.

---

# Documentation Updates

The implementation must update all documentation affected by the new runtime emitter architecture.

At minimum:

* `README.md`

  * Add an overview of runtime emitters and the Express target.

* `AGENTS.md`

  * Explain the separation between compiler, semantic graph and runtime emitters.

* `docs/architecture.md`

  * Introduce the Runtime Emitter layer in the compilation pipeline.

* `docs/plugin-system.md`

  * Document runtime emitters as a dedicated plugin category.

* `docs/extensibility.md`

  * Explain how to create new runtime emitter plugins.

* `docs/harness.md`

  * Update engineering guidance to prefer runtime generation over runtime abstraction.

* Every affected `SKILL.md`

  * Update examples and architectural guidance to use runtime emitters instead of runtime framework integration.

All examples should consistently use the Runtime Emitter terminology.
