---
name: typescript-type-engineering
description: Design TypeScript APIs that enforce Smite's architectural rules at compile time through strong typing and type inference.
---

# TypeScript Type Engineering

## Purpose

The TypeScript type system is the first validation layer of Smite.

Framework misuse should fail during compilation whenever possible.

Runtime validation is the last line of defense.

---

# Philosophy

Types should express architectural intent.

Developers should discover correct usage through autocomplete and type inference rather than documentation alone.

---

# Design Goals

Prioritize:

- Strong type inference
- Minimal annotations
- Clear diagnostics
- Architectural correctness
- Stable public APIs

Avoid exposing unnecessary generic complexity.

---

# Compile-Time Validation

Use the type system to prevent:

- Invalid builder states
- Missing required configuration
- Invalid plugin composition
- Unsupported feature combinations
- Illegal state transitions

If a rule can be represented as a type, prefer that over runtime validation.

---

# Builder State

Builders should model progressive state.

Each method should refine the resulting type.

Only valid builder states should expose terminal operations such as:

build()

Avoid builders that allow incomplete configurations.

---

# Descriptor Types

Semantic metadata should use explicit, discriminated types.

Avoid loosely typed structures.

Good:

RouteNode
BucketNode
QueueNode

Avoid:

Node<any>

---

# Generic Design

Generics should model relationships.

Examples:

- Builder → Node
- Plugin → Artifact
- Graph → Node Kind

Generics should improve readability, not obscure it.

---

# Type Inference

Prefer APIs where the compiler infers types naturally.

Developers should rarely need:

- explicit generic parameters
- type assertions
- casts

Inference should preserve semantic information across composition.

---

# Public APIs

Public types are contracts.

Changing exported types may introduce breaking changes even when runtime behavior remains identical.

Design them for long-term evolution.

---

# Runtime Separation

Types describe compile-time concepts.

Never rely on runtime type inspection to implement framework behavior.

Reflection is not a substitute for proper type modeling.

---

# Error Messages

Prefer types that produce understandable compiler diagnostics.

A helpful compiler error is part of the developer experience.

Avoid deeply nested conditional types that generate unreadable messages.

---

# Anti-Patterns

Avoid:

- any
- unnecessary type assertions
- opaque generic hierarchies
- duplicated type definitions
- runtime validation for compile-time concepts

---

# Checklist

Before introducing a public type:

- Does it model an architectural concept?
- Can inference remove manual annotations?
- Does it improve compile-time safety?
- Is it understandable?
- Will it evolve without unnecessary breaking changes?

If not, redesign the type.

---

# Guiding Principle

The compiler should prevent incorrect framework usage long before the application executes.
