---
name: diagnostics
description: Design diagnostics that help developers identify, understand and fix architectural, semantic and compilation problems.
---

# Diagnostics

## Purpose

Diagnostics communicate problems discovered during compilation.

A diagnostic should explain what happened, why it happened, where it happened and how to fix it.

Diagnostics are part of the developer experience.

---

# Philosophy

Fail early.

Fail precisely.

Fail with guidance.

A compiler should never produce vague errors when semantic information is available.

---

# Categories

Diagnostics may report:

- Errors
- Warnings
- Suggestions
- Informational messages

Errors prevent compilation.

Warnings identify potential problems.

Suggestions improve architecture.

---

# Every Diagnostic Should Include

- Severity
- Stable error code
- Human-readable message
- Affected semantic node
- Source location (when available)
- Suggested resolution

---

# Semantic First

Diagnostics should reference semantic concepts rather than implementation details.

Prefer:

"Route 'users.create' references an unknown queue."

Over:

"Undefined object at line 82."

---

# Determinism

The same application must always produce the same diagnostics.

Avoid environment-dependent messages.

Avoid non-deterministic ordering.

---

# Validation Stages

Diagnostics may originate from:

- Builder validation
- Registry validation
- Semantic Graph validation
- Compiler plugins
- Artifact generation

Each stage should validate only its own responsibilities.

---

# Actionable Messages

Good diagnostics explain:

- What failed
- Why it failed
- What to change

Avoid generic messages such as:

"Invalid configuration."

---

# Error Codes

Every diagnostic should expose a stable identifier.

Example:

SMT0001
SMT0104
SMT2007

Applications and tooling should rely on codes instead of message text.

---

# Recovery

When possible, continue compilation after independent errors.

Reporting multiple actionable issues is preferable to failing on the first one.

---

# Anti-Patterns

Avoid:

- Stack traces as user-facing diagnostics
- Compiler implementation details
- Ambiguous wording
- Duplicate reports for the same problem
- Errors without suggested fixes

---

# Checklist

Before adding a diagnostic:

- Is the message actionable?
- Is the affected semantic node identified?
- Is the wording deterministic?
- Does it expose a stable error code?
- Would a new contributor understand it?

If not, improve the diagnostic.

---

# Guiding Principle

A compiler error should teach the developer how to fix the application, not how the compiler works.
