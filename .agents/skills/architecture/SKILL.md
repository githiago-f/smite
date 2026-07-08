---
name: architecture
description: Understand Smite's architectural principles before proposing, implementing, or reviewing any framework feature.
---

# Architecture

## Purpose

This skill defines the architectural invariants of Smite.

Before implementing any feature, ensure it preserves these principles. If a proposed change violates one or more invariants, redesign the solution before writing code.

---

# Smite Is A Semantic Compiler

Smite is **not** a runtime framework.

Applications describe intent through a functional TypeScript DSL.

Compilation transforms that intent into:

- Runtime code
- Infrastructure
- Documentation
- SDKs
- Deployment artifacts

The runtime is the product of compilation.

---

# Core Principles

## Compile-Time First

Prefer solving problems during compilation instead of runtime.

If a feature can exist only during compilation, it should.

---

## Functional DSL

Builders describe intent.

Builders never provision infrastructure.

Builders never execute business logic.

Builders never perform I/O.

---

## Semantic Graph

The Semantic Graph is the single source of truth.

Every compiler plugin consumes the graph.

Plugins should never inspect application source code independently.

---

## Ephemeral Registry

The Registry exists only during compilation.

Lifecycle:

1. Create
2. Collect metadata
3. Normalize
4. Validate
5. Build Semantic Graph
6. Execute plugins
7. Generate artifacts
8. Destroy

Nothing from the Registry may survive into the runtime bundle.

---

## Zero Runtime Cost

Anything used only to express intent should disappear after compilation.

Builders, registry objects and compiler plugins must never leak into production code.

---

## Static Analysis

Prefer:

- Static imports
- Immutable metadata
- Pure functions
- Deterministic execution

Avoid:

- Reflection
- Decorators
- Runtime discovery
- Global mutable state
- Dynamic imports for framework structure

---

# Plugin Model

Smite supports two plugin categories.

## Compiler Plugins

Execute only during compilation.

Typical examples:

- AWS
- CloudFormation
- OpenAPI
- Documentation
- SDK generation
- Testing

Compiler plugins should normally be development dependencies.

## Runtime Plugins

Remain in the production bundle.

Typical examples:

- Logging
- Metrics
- Authentication
- Caching
- Retries

Runtime plugins should exist only when runtime behavior is required.

---

# Design Rules

When designing a new feature, ask:

1. Can this be solved at compile time?
2. What semantic information does it contribute?
3. Should it become a graph node or relationship?
4. Can future plugins consume this information?
5. Can this disappear after compilation?

If the answer to the last question is "yes", it belongs in the compiler.

---

# Framework Responsibilities

Builders:
- Express intent.

Registry:
- Collect metadata.

Semantic Graph:
- Represent the application.

Compiler:
- Validate and orchestrate.

Plugins:
- Generate artifacts.

Runtime:
- Execute business logic only.

---

# Never Do

- Mix runtime state with semantic metadata.
- Generate infrastructure directly from runtime objects.
- Duplicate configuration across artifacts.
- Depend on execution order for semantic correctness.
- Introduce global mutable compiler state.

---

# Guiding Principle

Write intent.

Compile reality.

Ship only what executes.
