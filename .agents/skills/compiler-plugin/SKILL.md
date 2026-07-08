---
name: compiler-plugin
description: Design compiler plugins that transform the Semantic Graph into production artifacts while remaining deterministic, isolated and platform-agnostic.
---

# Compiler Plugin

## Purpose

Compiler plugins extend Smite.

They transform the Semantic Graph into artifacts.

Compiler plugins never execute in production.

---

# Philosophy

The compiler owns semantics.

Plugins own transformations.

A plugin should answer:

> "Given this application, what artifact can I generate?"

It should never modify the application's meaning.

---

# Responsibilities

Compiler plugins may:

- Read the Semantic Graph
- Validate semantic rules
- Generate artifacts
- Emit diagnostics
- Contribute metadata to later compilation phases

Compiler plugins must not:

- Execute business logic
- Depend on runtime state
- Provision infrastructure directly
- Mutate application metadata
- Modify source files

---

# Execution Model

Compilation follows a pipeline.

Semantic Graph
→ Plugin
→ Artifact

Each plugin receives the same immutable graph.

Plugins should never depend on execution side effects from other plugins.

---

# Inputs

A plugin should consume only:

- Compiler Context
- Semantic Graph
- Plugin Configuration

Never inspect:

- Source files
- Runtime objects
- Builder implementations

The Semantic Graph already contains the required information.

---

# Outputs

Plugins generate artifacts.

Examples:

- Runtime code
- CloudFormation
- OpenAPI
- SDKs
- IAM policies
- Documentation
- Diagrams
- Validation reports

Artifacts should be reproducible.

---

# Determinism

Given the same graph, a plugin must always generate the same output.

Avoid:

- Random identifiers
- Current timestamps
- Environment-dependent behavior
- Network requests
- External mutable state

---

# Validation

Plugins may validate domain-specific rules.

Examples:

- Invalid HTTP routes
- Unsupported AWS configurations
- Missing IAM permissions
- Duplicate OpenAPI operations

Validation should produce actionable diagnostics.

---

# Isolation

Plugins should be independent.

One plugin should not require internal knowledge of another.

Shared behavior belongs in the compiler kernel, not inside plugins.

---

# Artifact Generation

Generate artifacts from semantic information.

Good:

Semantic Graph
→ CloudFormation

Avoid:

Source Code
→ CloudFormation

The graph is the only supported input.

---

# Plugin Lifecycle

A compiler plugin should follow this lifecycle:

1. Receive compiler context
2. Read Semantic Graph
3. Validate semantic constraints
4. Build an intermediate model if necessary
5. Generate artifacts
6. Emit diagnostics
7. Finish without mutating compiler state

---

# Intermediate Models

Complex generators should build an intermediate representation before writing artifacts.

Example:

Semantic Graph
→ AWS Model
→ CloudFormation

Instead of:

Semantic Graph
→ CloudFormation

Intermediate models improve maintainability and reuse.

---

# Error Reporting

Diagnostics should:

- Identify the affected node
- Explain the violation
- Suggest a correction
- Remain deterministic

Compiler errors should help users fix architecture, not debug compiler internals.

---

# Anti-Patterns

Avoid:

- Plugin-specific graph mutations
- Runtime dependencies
- Reading application source directly
- Hidden communication between plugins
- Artifact generation from runtime implementations

---

# Checklist

Before implementing a compiler plugin, verify:

- Does it consume only the Semantic Graph?
- Is it deterministic?
- Is it isolated?
- Does it avoid runtime dependencies?
- Does it generate reproducible artifacts?
- Can it run independently?

If any answer is "no", redesign the plugin.

---

# Guiding Principle

Compiler plugins transform semantics into artifacts.

They never become part of the runtime.
