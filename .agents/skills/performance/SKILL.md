---
name: performance
description: Design compiler features that maximize deterministic performance, scalability and minimal runtime overhead.
---

# Performance

## Purpose

Performance is a core architectural requirement.

Smite should move work from runtime to compile-time whenever possible.

Compiler performance and generated runtime performance are equally important.

---

# Philosophy

Optimize semantics.

Not implementations.

A well-designed compiler naturally produces efficient applications.

---

# Priorities

Optimize, in order:

1. Runtime overhead
2. Bundle size
3. Deterministic compilation
4. Memory usage
5. Compilation throughput

Never sacrifice architecture for micro-optimizations.

---

# Runtime First

Every compile-time optimization that removes runtime work is preferred.

Good examples:

- Generated lookup tables
- Generated route dispatchers
- Generated dependency maps

Avoid runtime reflection and dynamic discovery.

---

# Static Analysis

Design features that are statically analyzable.

Prefer:

- Static imports
- Immutable structures
- Explicit relationships
- Compile-time metadata

Avoid runtime inspection.

---

# Semantic Graph Efficiency

The Semantic Graph should be:

- Immutable
- Compact
- Deterministic
- Cheap to traverse

Avoid duplicated semantic information.

---

# Builders

Builders should:

- Allocate minimally
- Avoid unnecessary copies
- Remain pure
- Produce immutable metadata

They should never perform expensive runtime work.

---

# Compiler Pipeline

Each compilation phase should have one responsibility.

Avoid revisiting previous phases unnecessarily.

Prefer single-pass transformations whenever practical.

---

# Plugin Performance

Compiler plugins should:

- Traverse the graph efficiently
- Cache local computations when appropriate
- Avoid repeated graph scans
- Build intermediate models only when valuable

Plugins should never compromise determinism.

---

# Incremental Compilation

Future compiler features should support incremental compilation.

Compiler state should be partitioned to allow partial recompilation without changing semantics.

Never couple unrelated compilation units.

---

# Memory

Prefer:

- Shared immutable structures
- Stable identifiers
- Streaming artifact generation

Avoid retaining temporary data after it is no longer needed.

---

# Generated Runtime

Generated applications should:

- Be tree-shakable
- Avoid framework abstractions
- Minimize allocations
- Execute predictable code paths

Compilation should eliminate unnecessary layers.

---

# Measurement

Optimize only after measuring.

Use representative workloads.

Benchmark:

- Compilation time
- Memory consumption
- Graph construction
- Plugin execution
- Artifact generation
- Runtime bundle size

---

# Anti-Patterns

Avoid:

- Premature optimization
- Runtime reflection
- Dynamic module discovery
- Hidden allocations
- Global mutable caches
- Duplicate graph traversals

---

# Checklist

Before introducing a feature:

- Does it increase runtime cost?
- Can work move to compile-time?
- Is the graph still efficient?
- Does it preserve determinism?
- Is performance measurable?

If not, redesign the solution.

---

# Guiding Principle

Spend compiler time so applications spend less runtime.
