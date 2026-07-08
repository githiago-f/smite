---
name: builder-design
description: Design builders that express application intent while remaining pure, deterministic and compile-time only.
---

# Builder Design

## Purpose

Builders are the public language of Smite.

They are not runtime APIs.

Their responsibility is to describe application semantics that the compiler can understand.

---

# Builder Philosophy

A builder should answer:

> "What does the application require?"

It should never answer:

> "How should this be implemented?"

Implementation belongs to compiler plugins.

---

# Responsibilities

Builders may:

- Express intent
- Validate local configuration
- Produce immutable semantic metadata
- Register metadata in the compiler context

Builders must not:

- Perform I/O
- Provision infrastructure
- Execute business logic
- Read environment state
- Generate artifacts
- Invoke cloud providers

---

# Purity

Builders should be pure functions.

Given the same input, they must always produce the same semantic result.

Avoid:

- Hidden state
- Random values
- Current timestamps
- Global registries
- Side effects

---

# Immutability

Builder outputs are immutable.

Never mutate metadata after it has been registered.

Prefer creating new objects instead of modifying existing ones.

---

# Composition

Builders should compose small concepts.

Good:

- route()
- queue()
- bucket()
- schedule()

Prefer composition over configuration.

Avoid builders with dozens of unrelated options.

---

# Metadata First

Every builder exists to produce semantic metadata.

Before implementing a builder, ask:

- What information should be captured?
- Which plugins will consume it?
- Should it become a graph node?
- Should it create graph relationships?

If no meaningful metadata exists, reconsider the builder.

---

# Validation

Validate as early as possible.

Reject invalid configurations during builder creation instead of allowing failures later in the pipeline.

Validation should be deterministic and independent of runtime.

---

# Runtime Separation

Builders never perform runtime work.

Correct flow:

Builder
→ Metadata
→ Semantic Graph
→ Compiler Plugin
→ Generated Artifact

Incorrect flow:

Builder
→ AWS SDK
→ Cloud API

---

# API Design

Builders should be:

- Discoverable
- Strongly typed
- Minimal
- Predictable
- Easy to compose

Avoid exposing implementation details through the public API.

---

# Checklist

Before adding a new builder, verify:

- Does it describe intent?
- Is it compile-time only?
- Is it pure?
- Is it immutable?
- Does it generate useful metadata?
- Can plugins consume that metadata?
- Does it avoid runtime behavior?

If any answer is "no", redesign the builder.

---

# Guiding Principle

Builders describe what the application is.

Compiler plugins decide how that intent becomes reality.
