---
name: compiler-pipeline
description: Design and evolve the Smite compilation pipeline while preserving deterministic execution and clear phase boundaries.
---

# Compiler Pipeline

## Purpose

The compiler pipeline defines how an application becomes production artifacts.

Every phase has a single responsibility.

Each phase receives well-defined inputs and produces well-defined outputs.

---

# Philosophy

Compilation is a transformation pipeline.

Each phase enriches the application model.

No phase should perform work that belongs to another phase.

---

# Pipeline

The canonical Smite pipeline is:

Source Code
→ Builders
→ Metadata Collection
→ Registry
→ Normalization
→ Semantic Graph
→ Validation
→ Compiler Plugins
→ Intermediate Models
→ Artifact Generation
→ Bundling
→ Runtime

Every compilation follows this order.

---

# Phase Responsibilities

## Source Code

User code expresses application intent.

No semantic processing occurs here.

---

## Builders

Builders produce immutable semantic metadata.

Builders do not execute infrastructure or business logic.

---

## Metadata Collection

The compiler gathers metadata emitted by builders.

Collection must be deterministic.

---

## Registry

The Registry stores semantic metadata during compilation.

It exists only for the lifetime of the compilation.

---

## Normalization

Normalize collected metadata.

Resolve defaults.

Canonicalize identifiers.

Remove ambiguity before graph construction.

---

## Semantic Graph

Build the canonical graph representation.

Create nodes.

Resolve relationships.

Establish ownership.

---

## Validation

Validate the graph before generation.

Examples:

- Missing references
- Duplicate identifiers
- Invalid ownership
- Cycles
- Semantic violations

Generation should never begin with an invalid graph.

---

## Compiler Plugins

Compiler plugins consume the immutable Semantic Graph.

Plugins may:

- Validate platform rules
- Build intermediate models
- Emit diagnostics
- Generate artifacts

Plugins must not mutate the graph.

---

## Intermediate Models

Large generators should transform semantic concepts into platform-specific models.

Examples:

Semantic Graph
→ AWS Model

Semantic Graph
→ HTTP Model

Semantic Graph
→ Client SDK Model

Intermediate models isolate platform complexity.

---

## Artifact Generation

Serialize intermediate models into production artifacts.

Examples:

- Runtime
- CloudFormation
- OpenAPI
- SDKs
- Documentation

Generation should be deterministic.

---

## Bundling

Bundle executable runtime code.

Remove compile-time abstractions.

Maximize tree shaking.

The runtime should contain only executable behavior.

---

## Runtime

Compilation ends.

Only generated runtime code remains.

Compiler concepts no longer exist.

---

# Phase Boundaries

Each phase communicates only with adjacent phases.

Avoid:

Builders
→ Compiler Plugins

Registry
→ Runtime

Runtime
→ Semantic Graph

Respect the pipeline.

---

# Diagnostics

Each phase should report only errors related to its responsibility.

Do not delay validation that can happen earlier.

Fail as soon as enough semantic information exists.

---

# Determinism

Pipeline execution must always be deterministic.

Never depend on:

- File ordering
- Import timing
- Runtime state
- Parallel execution order

Identical inputs must produce identical outputs.

---

# Evolution

When introducing a new compiler feature, identify:

- Which phase owns it
- Which phase consumes it
- Which phase validates it

Avoid adding responsibilities to unrelated phases.

---

# Anti-Patterns

Avoid:

- Skipping pipeline phases
- Mutating previous phase outputs
- Cross-phase dependencies
- Platform-specific logic before plugin execution
- Runtime concepts inside compile-time phases

---

# Checklist

Before modifying the pipeline:

- Does every phase have one responsibility?
- Are boundaries preserved?
- Is execution deterministic?
- Are compiler concepts removed before runtime?
- Can plugins remain independent?

If not, redesign the pipeline.

---

# Guiding Principle

Compilation is a sequence of deterministic semantic transformations.

Each phase prepares the next, until only executable software remains.
