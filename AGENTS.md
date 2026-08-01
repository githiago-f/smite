# AGENTS.md

Welcome.

This repository contains a compile-time-first TypeScript framework built as a Yarn Workspace monorepo.

The framework is a semantic compiler. Applications describe intent through a functional DSL while the compiler generates runtime code, infrastructure, documentation and other artifacts.
Runtime emitters are compile-time plugins that generate platform-native runtime source, such as Express modules, and runtime adapters translate platform inputs and outputs into the core execution model.

This document is the entry point for contributors and AI agents.

---

# Read First

Documentation is intentionally layered.

Read documents in this order:

1. `README.md`
2. `.docs/architecture.md`
3. `.docs/runtime-contract.md`
4. `.docs/harness.md`
5. `.docs/plugin-system.md`
6. `.docs/extensibility.md`
7. `.agents/skills/*/SKILL.md`

Each document assumes the previous one has already been read.

Do not duplicate concepts already defined by the documentation.

# Mandatory Quality Bar

Every public capability requires all three of these. They are not negotiable:

1. At least one example — a runnable example in `examples/` or a tested snippet.
2. Full docs on usage — documented with `@example` references that resolve to tested snippets.
3. Tests — automated tests through the public API in the same package.

See `.docs/runtime-contract.md` for the full contracts.

---

# Repository Layout

```
.
├── README.md
├── AGENTS.md
├── .docs/
├── .agents/skills/
├── packages/
│   ├── compiler/
│   ├── core/
│   ├── builders/
│   ├── registry/
│   ├── graph/
│   └── cli/
│       ├── commands/
│       └── generators/
├── plugins/
├── runtime/
└── examples/
```

Every top-level directory has a single responsibility.

---

# Documentation

## README

Project overview.

Explains what the framework is, why it exists and how to get started.

---

## .docs/architecture.md

Defines the architecture of the framework.

This is the canonical source for architectural decisions.

---

## .docs/harness.md

Defines engineering heuristics.

Use these guidelines when making implementation decisions.

---

## .docs/plugin-system.md

Defines the execution model.

Development Time

↓

Compile Time

↓

Runtime

It explains which components exist during each phase and their responsibilities.

---

## .docs/extensibility.md

Defines every supported extension point.

Before modifying the framework kernel, verify whether the feature belongs in an extension.

---

## skills/

Skills contain specialized knowledge.

Skills complement the documentation.

They should never redefine architecture or duplicate concepts already documented.

---

# Extension Model

The framework is designed to grow through extensions.

Whenever possible, extend the platform instead of modifying the kernel.

Supported extension types include:

- Builders
- Compiler Plugins
- Runtime Emitters
- Runtime Plugins
- CLI Generators
- CLI Commands

Each extension has a single responsibility.

---

# Monorepo

The repository uses Yarn Workspaces.

Each workspace should:

- own a single responsibility;
- expose a minimal public API;
- remain independently testable;
- avoid circular dependencies;
- minimize coupling with other workspaces.

Communication between packages should occur only through public APIs.

---

# Architectural Rules

Always preserve these principles:

- Compile-time first.
- Functional and immutable APIs.
- Static analysis over runtime discovery.
- Semantic Graph as the single source of truth.
- Provider-agnostic business logic.
- Zero unnecessary runtime cost.

Anything that exists only to describe intent should disappear after compilation.

---

# Before Writing Code

Ask yourself:

1. Which execution phase owns this feature?
2. Does it belong in the kernel or as an extension?
3. Can existing abstractions be reused?
4. Does this increase runtime cost?
5. Does this preserve architectural boundaries?
6. Does this require updating the documentation?

If the answer is unclear, consult the documentation before implementing.

---

# Guiding Principle

The kernel orchestrates.

Extensions provide capabilities.

Applications describe intent.

The compiler generates artifacts.
Runtime emitters generate runtime source before the final bundle exists.
The core owns semantic execution order and runtime adapters only translate between platform objects and core execution context/result shapes.

Runtime executes only what cannot be eliminated.
