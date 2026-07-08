---
name: runtime-plugin
description: Design runtime plugins that add executable behavior while remaining minimal, composable and independent from the compiler.
---

# Runtime Plugin

## Purpose

Runtime plugins provide behavior that must exist after compilation.

Unlike compiler plugins, runtime plugins become part of the production bundle.

Use them only when execution requires it.

---

# Philosophy

Prefer compile-time.

Choose a runtime plugin only when the feature cannot disappear after compilation.

Every runtime dependency has a cost.

---

# When To Use

Appropriate runtime plugins include:

- Logging
- Metrics
- Authentication
- Authorization
- Caching
- Retries
- Transactions
- Tracing

Inappropriate runtime plugins include:

- OpenAPI generation
- CloudFormation generation
- Documentation
- SDK generation
- Static validation

Those belong in compiler plugins.

---

# Responsibilities

Runtime plugins may:

- Execute code
- Intercept requests
- Collect telemetry
- Integrate with runtime services
- Compose middleware

Runtime plugins must not:

- Generate artifacts
- Build infrastructure
- Modify the Semantic Graph
- Depend on compiler internals

---

# Design Principles

Runtime plugins should be:

- Small
- Composable
- Tree-shakable
- Deterministic
- Independently testable

Avoid monolithic plugins.

---

# Public API

Expose behavior through small composable primitives.

Good:

logger()
cache()
retry()

Avoid large configuration-heavy APIs that combine unrelated behaviors.

---

# Runtime State

Runtime state belongs to the runtime.

Never mix runtime state with semantic metadata.

Compiler metadata must remain immutable.

---

# Performance

Every runtime plugin should justify its existence.

Consider:

- Startup time
- Memory usage
- Bundle size
- Allocation rate
- Execution overhead

If the feature can move to compile-time, it should.

---

# Dependencies

Keep runtime dependencies minimal.

Avoid requiring large libraries for small features.

Design for tree shaking.

---

# Extension

Runtime plugins should compose naturally.

Prefer:

auth(
  logging(
    handler
  )
)

Over tightly coupled plugin systems.

---

# Anti-Patterns

Avoid:

- Hidden global state
- Compiler dependencies
- Artifact generation
- Runtime reflection
- Implicit initialization
- Platform-specific assumptions

---

# Checklist

Before creating a runtime plugin:

- Is runtime execution truly required?
- Can this be solved during compilation?
- Is the API composable?
- Is the plugin tree-shakable?
- Is runtime overhead justified?
- Does it avoid compiler concerns?

If not, redesign the feature.

---

# Guiding Principle

Runtime plugins execute behavior.

Compiler plugins describe behavior.

Never confuse the two.
