---
name: extensibility
description: Design framework extensions that integrate naturally with Smite while preserving architectural consistency.
---

# Extensibility

## Purpose

Smite is designed to grow through extensions.

New capabilities should be added by extending the compiler, not modifying the kernel.

---

# Philosophy

The kernel should remain small.

Extensions provide platform support, integrations and advanced capabilities.

The core orchestrates.

Extensions specialize.

---

# Extension Points

Extensions may provide:

- Builders
- Compiler plugins
- Runtime plugins
- Artifact generators
- Diagnostics
- Validation rules
- CLI commands

Each extension should have a single responsibility.

---

# Integration

Every extension should integrate through stable public APIs.

Avoid relying on:

- Internal compiler state
- Private modules
- Implementation details
- Monkey patches

Public contracts are the only supported integration surface.

---

# Semantic First

Extensions should enrich the Semantic Graph.

Before adding behavior, ask:

- Does this introduce a new semantic concept?
- Does it create new relationships?
- Can existing nodes be reused?

Avoid duplicating semantic information.

---

# Compiler Boundaries

Extensions should respect layer boundaries.

Builders
→ Semantic Graph
→ Compiler Plugins
→ Artifacts

Do not bypass the compiler pipeline.

---

# Platform Isolation

Platform-specific logic belongs inside the extension.

Examples:

@smite/aws
@smite/openapi
@smite/cloudformation

The compiler should remain platform agnostic.

---

# Configuration

Configuration should be explicit and typed.

Prefer small composable options.

Avoid global configuration objects shared across unrelated extensions.

---

# Compatibility

Extensions should degrade gracefully.

Missing optional extensions should never prevent unrelated compiler features from working.

---

# Versioning

Treat extension APIs as contracts.

Avoid breaking public APIs without a migration path.

Prefer additive evolution.

---

# Anti-Patterns

Avoid:

- Forking compiler behavior
- Modifying compiler internals
- Shared mutable global state
- Cross-extension coupling
- Platform logic inside the kernel

---

# Checklist

Before creating an extension:

- Does it use public APIs only?
- Is it independent?
- Does it enrich the Semantic Graph?
- Is platform logic isolated?
- Can it evolve independently?

If not, redesign the extension.

---

# Guiding Principle

Extend the compiler.

Do not enlarge the kernel.
