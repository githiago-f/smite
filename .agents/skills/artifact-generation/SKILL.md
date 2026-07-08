---
name: artifact-generation
description: Design deterministic artifact generators that transform semantic models into deployable outputs without depending on runtime implementations.
---

# Artifact Generation

## Purpose

Artifact generators transform semantic information into production outputs.

They do not execute applications.

They materialize compiler knowledge.

---

# Philosophy

Artifacts are outputs.

The Semantic Graph is the source of truth.

Generation should always flow in one direction:

Semantic Graph
→ Intermediate Model
→ Artifact

Never generate artifacts directly from runtime code.

---

# Supported Artifacts

Examples include:

- Runtime code
- CloudFormation
- Terraform
- OpenAPI
- SDKs
- IAM Policies
- Markdown documentation
- Architecture diagrams
- Deployment manifests

Every artifact must derive from the same semantic model.

---

# Intermediate Models

Complex generators should introduce an intermediate representation.

Example:

Semantic Graph
→ AWS Model
→ CloudFormation

Semantic Graph
→ HTTP Model
→ OpenAPI

Semantic Graph
→ Client Model
→ SDK

Intermediate models isolate platform concerns from compiler semantics.

---

# Determinism

Generation must be reproducible.

Given the same Semantic Graph:

- Output must be identical.
- Ordering must be stable.
- Naming must be deterministic.

Avoid:

- Random identifiers
- Current timestamps
- Non-deterministic iteration
- Environment-specific output

---

# Separation of Concerns

The compiler defines semantics.

Intermediate models define platform concepts.

Generators serialize platform concepts.

Do not combine these responsibilities.

---

# Validation

Validate before generation.

Examples:

- Missing required fields
- Invalid references
- Unsupported platform features
- Duplicate resource names

Fail fast with actionable diagnostics.

---

# Serialization

Serialization should be the final step.

Avoid embedding business logic in serializers.

Good:

Semantic Graph
→ Model
→ YAML

Avoid:

Semantic Graph
→ YAML with platform logic

---

# Stable Naming

Resource names should be predictable.

Prefer names derived from semantic identity.

Avoid names derived from execution order.

---

# Incremental Generation

Generators should emit only what they own.

Do not rewrite unrelated artifacts.

Support future incremental compilation.

---

# Plugin Independence

Generators should not depend on other generators.

If multiple generators require shared transformations, move that logic into a reusable intermediate model.

---

# Anti-Patterns

Avoid:

- Reading runtime objects
- Inspecting application source
- Platform logic inside the Semantic Graph
- Mixing serialization with validation
- Mutating compiler state during generation

---

# Checklist

Before implementing a generator:

- Does it consume semantic information only?
- Does it produce deterministic output?
- Does it use an intermediate model when appropriate?
- Is serialization isolated?
- Can the artifact be regenerated identically?

If not, redesign the generator.

---

# Guiding Principle

Semantic information is permanent.

Artifacts are disposable.

At any time, an artifact should be reproducible from the Semantic Graph alone.
