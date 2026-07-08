---
name: feature-design
description: Transform product requirements into Smite architecture before writing implementation code.
---

# Feature Design

## Purpose

Every feature begins with architecture.

Implementation is the final step.

Design the semantic model before writing builders, plugins or runtime code.

---

# Design Process

Always answer these questions in order.

## 1. Problem

What capability is missing?

Describe the problem without proposing a solution.

---

## 2. Intent

What should developers be able to express?

Focus on the public DSL.

Example:

route()
bucket()
queue()
schedule()

Do not think about implementation yet.

---

## 3. Semantics

What information should the compiler understand?

Identify:

- Semantic nodes
- Relationships
- Ownership
- Validation rules

Every feature should enrich the Semantic Graph.

---

## 4. Compilation

How does the compiler process this feature?

Determine:

- Builder metadata
- Graph construction
- Validation
- Plugin consumption

Avoid introducing runtime behavior unnecessarily.

---

## 5. Artifacts

Which outputs benefit from this feature?

Examples:

- Runtime
- CloudFormation
- OpenAPI
- SDKs
- Documentation
- IAM
- Diagnostics

A feature should enable tooling, not only execution.

---

## 6. Runtime

Does any behavior survive compilation?

If yes:

- Define the runtime boundary.
- Keep it minimal.
- Make it composable.

If no, keep the feature compile-time only.

---

# Design Checklist

Before implementation verify:

- Does the DSL express intent?
- Does the Semantic Graph improve?
- Can plugins consume the feature?
- Are diagnostics well-defined?
- Is the feature deterministic?
- Can unnecessary runtime be eliminated?

---

# Evolution

Prefer extending existing semantic concepts before introducing new ones.

New node types should exist only when they represent genuinely new concepts.

---

# Anti-Patterns

Avoid:

- Designing from infrastructure upward
- Starting with runtime code
- Encoding platform details in builders
- Duplicating semantic information
- Adding runtime for compiler problems

---

# Deliverables

A complete feature proposal should define:

- Public DSL
- Semantic model
- Validation rules
- Compiler pipeline impact
- Runtime impact
- Generated artifacts
- Testing strategy
- Migration considerations (if applicable)

Only after these are defined should implementation begin.

---

# Guiding Principle

Design semantics first.

Implementation follows architecture.
