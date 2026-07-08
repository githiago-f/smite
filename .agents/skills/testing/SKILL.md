---
name: testing
description: Design tests for the Smite compiler, builders, semantic graph and plugins to ensure deterministic and reproducible compilation.
---

# Testing

## Purpose

Testing verifies compiler behavior.

Smite tests architecture, semantics and generated artifacts rather than application business logic.

---

# Philosophy

Every compilation should be reproducible.

Given the same input, the compiler must always produce the same graph, diagnostics and artifacts.

Tests should enforce this guarantee.

---

# Test Levels

Smite testing is organized into:

- Builder tests
- Semantic Graph tests
- Compiler plugin tests
- Artifact generation tests
- Integration tests

Each level validates a single responsibility.

---

# Builder Tests

Verify that builders:

- Produce correct metadata
- Reject invalid configuration
- Remain pure
- Produce deterministic output

Builders should never require runtime execution.

---

# Semantic Graph Tests

Validate:

- Node creation
- Relationship creation
- Ownership
- Reference resolution
- Cycle detection
- Deterministic ordering

The graph is the compiler's primary contract.

---

# Compiler Plugin Tests

Plugins should be tested in isolation.

Provide:

- Compiler Context
- Semantic Graph
- Plugin configuration

Assert:

- Generated artifacts
- Diagnostics
- No graph mutation

---

# Artifact Tests

Artifacts should be treated as snapshots.

Verify:

- Stable output
- Deterministic ordering
- Correct serialization
- No unexpected changes

Intentional changes should update snapshots explicitly.

---

# Integration Tests

Integration tests validate the entire pipeline.

Builder
→ Registry
→ Semantic Graph
→ Plugins
→ Artifacts

Prefer representative applications over synthetic mocks.

---

# Determinism

Avoid tests that depend on:

- Current time
- Random values
- File ordering
- Environment variables
- Network access

Tests must produce identical results everywhere.

---

# Golden Files

Large generated artifacts should be validated using golden files.

Examples:

- CloudFormation
- OpenAPI
- Generated SDKs
- Documentation

Review diffs as part of normal development.

---

# Diagnostics

Tests should verify:

- Error codes
- Severity
- Affected node
- Suggested fixes

Diagnostics are part of the compiler contract.

---

# Anti-Patterns

Avoid:

- Testing implementation details
- Mocking semantic models excessively
- Snapshotting unstable output
- Network-dependent tests
- Hidden global state

---

# Checklist

Before adding a compiler feature:

- Are builders tested?
- Is the graph validated?
- Are diagnostics covered?
- Are generated artifacts verified?
- Is deterministic behavior guaranteed?

If not, the feature is incomplete.

---

# Guiding Principle

The compiler is correct only when identical inputs always produce identical outputs.
