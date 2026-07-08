---
name: semantic-graph
description: Design, evolve and consume the Semantic Graph, the canonical representation of every Smite application.
---

# Semantic Graph

## Purpose

The Semantic Graph is the heart of the Smite compiler.

Everything that exists in an application is represented as a graph.

Compiler plugins never inspect source code directly.

They consume the Semantic Graph.

---

# Philosophy

Source code is an implementation detail.

The Semantic Graph is the architectural model of the application.

Every generated artifact must originate from this graph.

The graph is the single source of truth for the compiler.

---

# Graph Model

The graph is composed of:

- Nodes
- Relationships

Nothing else.

Every framework concept should eventually become one or both.

---

# Nodes

Nodes represent semantic concepts.

Examples:

- Route
- Function
- Bucket
- Queue
- Topic
- Table
- Schedule
- Lambda
- Policy
- Event

A node should describe **what exists**, never **how it executes**.

---

# Relationships

Relationships connect nodes.

Examples:

Route
→ Function

Function
→ Queue

Queue
→ Consumer

Lambda
→ Role

Bucket
→ Notification

Relationships should always be explicit.

Never infer relationships from implementation details.

---

# Node Identity

Every node must have a stable identity.

A node identifier should:

- Be deterministic
- Remain stable across builds
- Be globally unique within the compilation

Avoid random identifiers.

---

# Graph Construction

The graph is built in stages.

1. Builders emit semantic metadata.
2. Metadata is registered.
3. Metadata is normalized.
4. Nodes are created.
5. Relationships are resolved.
6. Validation executes.
7. Plugins consume the graph.

The graph should be immutable once validation finishes.

---

# Ownership

Every node has an owner.

Ownership defines lifecycle.

Examples:

Application
→ Route

Route
→ Function

Function
→ Permission

Ownership should always form a valid hierarchy.

---

# References

Nodes should reference other nodes using stable identifiers.

Prefer semantic references over object references.

Good:

Function
→ Queue("emails")

Avoid:

Function
→ queueInstance

The graph should never depend on runtime objects.

---

# Validation

Every graph should validate:

- Duplicate identifiers
- Missing references
- Invalid ownership
- Cyclic dependencies
- Orphan nodes
- Invalid relationships

Graph validation is a compiler responsibility.

---

# Determinism

The same application must always produce the same graph.

Never depend on:

- File ordering
- Import ordering
- Execution timing
- Runtime state

Compilation must be deterministic.

---

# Plugin Consumption

Plugins consume only the Semantic Graph.

Plugins should never:

- Parse application files
- Inspect TypeScript ASTs independently
- Traverse builders
- Depend on source layout

The graph already contains every semantic relationship.

---

# Artifact Generation

Every artifact originates from the graph.

Examples:

Semantic Graph
→ Runtime

Semantic Graph
→ CloudFormation

Semantic Graph
→ OpenAPI

Semantic Graph
→ SDK

Semantic Graph
→ Documentation

Semantic Graph
→ IAM

No generator should bypass the graph.

---

# Evolution

Before introducing a new builder, ask:

- Does it create a new node?
- Does it introduce new relationships?
- Does it extend an existing node?
- Which plugins benefit from this information?

If the graph does not improve, reconsider the feature.

---

# Anti-Patterns

Avoid:

- Runtime objects inside nodes
- Mutable graph structures
- Hidden relationships
- Graph mutations during plugin execution
- Plugin-specific graph models

The Semantic Graph belongs to the compiler, not to individual plugins.

---

# Guiding Principle

The application is not the source code.

The application is the Semantic Graph built from that source code.
