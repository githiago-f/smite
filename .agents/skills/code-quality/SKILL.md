---
name: code-quality
description: Maintain consistent code quality across Smite using Biome, Vitest and deterministic engineering practices.
---

# Code Quality

## Purpose

Smite values consistency over personal preference.

Formatting, linting and testing should be automated and deterministic.

The goal is to reduce review noise and focus discussions on architecture.

---

# Tooling

The official development tools are:

- Biome
- Vitest

New contributions should integrate with these tools.

Do not introduce overlapping tooling unless there is a compelling architectural reason.

---

# Biome

Biome is responsible for:

- Formatting
- Linting
- Import organization
- Style consistency

Code should satisfy Biome without requiring manual formatting.

Avoid disabling rules unless absolutely necessary.

---

# Vitest

Vitest is the standard testing framework.

Tests should be:

- Fast
- Deterministic
- Isolated
- Easy to understand

Prefer small focused tests over large integration suites unless validating the compiler pipeline.

---

# Review Priorities

Code reviews should prioritize:

- Architectural correctness
- Semantic consistency
- Type safety
- Determinism
- API clarity

Formatting issues should already be handled automatically.

---

# Style Guidelines

Prefer:

- Small modules
- Pure functions
- Immutable data
- Explicit names
- Stable public APIs

Avoid:

- Hidden side effects
- Global mutable state
- Clever abstractions
- Unnecessary configuration

---

# Determinism

Never rely on:

- Current time
- Random values
- Execution order
- Platform-specific behavior

Generated output should remain reproducible.

---

# Pull Requests

Every contribution should:

- Pass Biome checks
- Pass all Vitest suites
- Preserve deterministic compilation
- Include tests for new behavior
- Avoid unrelated refactoring

---

# Checklist

Before merging:

- Does Biome report a clean result?
- Do all Vitest suites pass?
- Are new compiler behaviors tested?
- Is the public API unchanged or intentionally versioned?
- Does the change preserve Smite architecture?

---

# Guiding Principle

Automate consistency.

Spend human review time on architecture, not formatting.
