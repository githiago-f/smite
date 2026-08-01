# Engineering Harness

This document defines the engineering heuristics used throughout the project.

Unlike the architecture documentation, this document focuses on the reasoning process used when designing or modifying the framework.

These guidelines apply equally to human contributors and AI agents.

---

# Objective

Produce software that is:

- Simple
- Predictable
- Composable
- Testable
- Extensible
- Easy to maintain

Whenever multiple solutions are possible, prefer the one that minimizes long-term complexity.

---

# Engineering Mindset

Think like a framework architect, not an application developer.

Every change should improve the platform, not only solve the immediate problem.

Avoid implementing isolated solutions when a reusable abstraction naturally exists.

However, never introduce abstractions before they demonstrate clear value.

---

# Design Process

Before writing code, understand:

- the problem
- the affected architectural layer
- existing abstractions
- downstream consequences

Only then decide whether to:

- reuse;
- extend;
- replace;
- introduce something new.

Implementation should be the final step.

---

# Simplicity First

Prefer:

- small APIs
- explicit behavior
- deterministic execution
- functional composition

Avoid:

- hidden magic
- implicit state
- surprising behavior
- unnecessary configuration

Simple code is usually the correct code.

---

# Reuse Before Creation

Before introducing:

- a package
- a builder
- a plugin
- a runtime component

verify whether an existing component can be extended.

Duplicated concepts should be eliminated.

---

# Separate Responsibilities

Maintain strict boundaries between:

- DSL
- Compiler
- Runtime
- Providers
- Generated Artifacts

Responsibilities should never leak across layers.

---

# Runtime Is Expensive

Runtime code has a permanent cost.

Compile-time code disappears.

Whenever possible, move complexity into the compiler.

If the behavior can be emitted as source code, prefer a runtime emitter over a hand-written runtime abstraction.
If a target runtime needs a thin adapter, keep it focused on translating platform objects into the core execution context and result shape.

Ask:

> Can this be generated?

before implementing runtime behavior.

# Portability and Bare Metal

`.docs/runtime-contract.md` defines two contracts every feature must satisfy.

- **Portability**: write once, run anywhere. Application code and core express
  semantics only; every target is a compile-time projection of the Semantic
  Graph; adding a target never touches application code or the kernel.
- **Bare metal**: run close to the metal. Generated output is structurally
  equivalent to hand-written platform code, with zero-runtime-cost for
  intent-only features and the bar gated by the `benchmarks/` k6 harness against
  a hand-written twin.

The canonical targets are Express (runtime emitter) and PlantUML (documentation
projection). Triage every runtime cost with the question:

> Would a hand-written app on this same platform pay this cost at runtime?

Yes — compile it away or make it zero-cost. No — make it an opt-in extension.

# Compile-Time Constants

Optional behavior is guarded by global compile-time constants (`SMITE_TARGET`,
`SMITE_MODE`, `SMITE_DEBUG`, or application `--define KEY=VALUE`) that esbuild
folds at build time. Production bundles drop the guarded branches. Never ship a
dead branch that could have been folded away, and never turn a compile-time
constant into runtime state.

---

# Functional by Default

Prefer:

- immutable objects
- pure functions
- composition
- deterministic outputs

Avoid:

- mutable global state
- singleton services
- hidden caches
- execution-order dependencies

---

# Static Analysis

Everything should be understandable without executing user code.

Prefer:

- static imports
- explicit declarations
- deterministic metadata

Avoid:

- runtime discovery
- reflection
- decorators
- dynamic imports

---

# Evaluate Trade-offs

Every proposal should consider:

- readability
- maintainability
- extensibility
- performance
- bundle size
- compilation cost
- runtime cost

Optimizing one dimension while harming several others is rarely worthwhile.

---

# Monorepo Principles

Each workspace should own exactly one responsibility.

Packages communicate through stable public APIs.

Internal implementation details should remain private.

Dependencies should flow in one direction.

Avoid circular dependencies.

---

# Documentation

Documentation is part of the implementation.

Whenever behavior changes:

- update documentation;
- update examples;
- update related skills.

Documentation should remain the source of truth.

---

# Testing Philosophy

Tests should validate behavior, not implementation details.

Prefer:

- public API tests
- integration tests
- compiler output validation

Avoid tests tightly coupled to internal implementation.

---

# Decision Checklist

Before merging a change, verify:

- Is the solution simpler than the previous one?
- Can existing abstractions be reused?
- Does it preserve architectural boundaries?
- Can more work move to compile-time?
- Is runtime code minimized?
- Is the public API still coherent?
- Does the documentation remain accurate?
- Is the target a compile-time projection of the Semantic Graph, leaving application code and the kernel untouched?
- Would a hand-written app on this same platform pay the same runtime cost?
- Is generated output structurally equivalent to hand-written platform code?
- Is optional behavior guarded by a compile-time constant so production drops it?
- Does the change include at least one example, full usage docs and tests?

If multiple answers are "no", reconsider the design.

---

# Guiding Principle

Architecture first.

Implementation second.

Optimization last.

# Prefer Evolution Over Revolution

Large rewrites should be exceptional.

Whenever possible:

- extend existing abstractions;
- preserve compatibility;
- migrate incrementally.

Small improvements applied consistently usually produce better software than complete rewrites.

# Design for Plugins

Before adding functionality to the core, ask:

Should this be a plugin?

The kernel should remain as small as possible.

Capabilities belong in plugins unless they are fundamental to the compiler itself.
