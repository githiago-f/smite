---
name: compiler-context
description: Design and use the Compiler Context as the isolated execution environment for a single Smite compilation.
---

# Compiler Context

## Purpose

The Compiler Context owns every piece of state required during compilation.

It is created when compilation begins.

It is destroyed when compilation ends.

Nothing inside the Compiler Context survives into the runtime.

---

# Philosophy

Compilation should be completely isolated.

A Compiler Context represents exactly one compilation.

No global mutable state should exist outside of it.

---

# Responsibilities

The Compiler Context owns:

- Registry
- Semantic Graph
- Diagnostics
- Plugin state
- Compiler configuration
- Shared compilation services

Every compile-time component receives the same context.

---

# Lifecycle

A Compiler Context follows a strict lifecycle.

Create
→ Execute Pipeline
→ Destroy

Contexts are disposable.

Never reuse a Compiler Context between compilations.

---

# Isolation

Each compilation receives its own context.

This enables:

- Parallel compilation
- Incremental compilation
- Predictable behavior
- Test isolation

Compiler state must never leak across contexts.

---

# Registry

The Registry belongs to the Compiler Context.

It stores semantic metadata until the Semantic Graph has been constructed.

After compilation it becomes unreachable.

---

# Semantic Graph

The Semantic Graph is owned by the Compiler Context.

It becomes immutable after validation.

Plugins receive read-only access.

---

# Diagnostics

All diagnostics are collected through the Compiler Context.

Builders, validators and plugins should never emit diagnostics independently.

The context provides a single reporting mechanism.

---

# Plugin State

Plugins may store temporary execution state inside the Compiler Context.

Plugin state:

- Exists only during compilation
- Is isolated per plugin
- Must not modify compiler semantics
- Must never reach the runtime

---

# Shared Services

Shared compile-time services may live in the Compiler Context.

Examples:

- Name generation
- Identifier allocation
- File emission
- Serialization helpers
- Dependency resolution

Services should remain stateless whenever possible.

---

# Determinism

Compiler Context contents must depend only on:

- Source code
- Compiler configuration
- Plugin configuration

Never depend on:

- Global variables
- Previous compilations
- External mutable state

---

# Thread Safety

Multiple Compiler Contexts may execute simultaneously.

Avoid:

- Static mutable variables
- Singleton registries
- Shared caches without isolation

The Compiler Context is the synchronization boundary.

---

# Ownership

Objects created during compilation belong to exactly one Compiler Context.

Cross-context references are forbidden.

Destroying a context should release every compile-time object.

---

# Anti-Patterns

Avoid:

- Registry.instance()
- Global compiler services
- Shared mutable plugin state
- Runtime objects inside the context
- Persisting compiler state after compilation

---

# Checklist

Before introducing compiler state:

- Does it belong to a single compilation?
- Can it live inside the Compiler Context?
- Is it deterministic?
- Is it isolated?
- Will it disappear after compilation?

If not, redesign the feature.

---

# Guiding Principle

The Compiler Context is the temporary universe in which a Smite compilation exists.

When compilation ends, that universe disappears completely.
