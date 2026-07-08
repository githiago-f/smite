# Architecture

## Vision

This project is a compile-time-first application framework built as a Yarn Workspace monorepo.

Applications are written as declarative TypeScript.

Compilation transforms those declarations into production-ready runtime artifacts.

The framework is not intended to be a runtime platform.

---

# Design Goals

- Minimal runtime.
- Provider-agnostic business logic.
- Functional APIs.
- Static analysis.
- Predictable builds.
- Independent packages.
- Extensible compiler.

---

# Monorepo

The repository uses Yarn Workspaces.

The monorepo is divided into packages with clear responsibilities.

Example:

```
packages/
    compiler/
    core/
    builders/
    registry/
    graph/

plugins/
    aws/
    openapi/
    cloudformation/

runtime/
    http/
    logger/
    auth/

examples/

docs/

skills/
```

Each workspace owns a single concern.

Cross-package dependencies should remain minimal.

Circular dependencies are prohibited.

---

# Architecture Layers

```
Application

↓

Functional DSL

↓

Semantic Registry

↓

Semantic Graph

↓

Compiler Pipeline

↓

Compiler Plugins

↓

Generated Artifacts

↓

Runtime
```

Each layer only depends on the layer immediately below it.

---

# Compiler

The compiler is responsible for:

- collecting semantic information
- validating declarations
- building the semantic graph
- executing compiler plugins
- generating artifacts

The compiler does not execute application logic.

---

# Registry

The registry exists only during compilation.

Lifecycle:

Create

↓

Collect

↓

Normalize

↓

Validate

↓

Plugin Execution

↓

Artifact Generation

↓

Destroy

No runtime component may depend on the registry.

---

# Semantic Graph

The semantic graph is the single source of truth.

Compiler plugins consume the graph instead of analyzing source files independently.

Generated artifacts must originate from this graph.

---

# Builders

Builders form a functional DSL.

They never perform infrastructure operations.

Example:

```
bucket("uploads")
```

does not create a bucket.

It declares an application requirement.

Providers decide how that requirement is implemented.

---

# Plugins

Plugins belong to two categories.

## Compile-time plugins

Generate artifacts.

Examples:

- AWS
- CloudFormation
- OpenAPI
- SDK
- Documentation

These should normally be development dependencies.

## Runtime plugins

Provide executable behavior.

Examples:

- Logger
- Authentication
- Metrics
- Retry

These become runtime dependencies.

---

# Runtime

The runtime should contain only code required to execute the application.

Metadata, builders, compiler state and registry must not survive compilation.

---

# Package Design

Every workspace should:

- expose a small public API;
- have a single responsibility;
- avoid mutable global state;
- be independently testable;
- support tree shaking.

---

# Guiding Principle

Write intent.

Compile reality.

Ship only what executes.
