---
title: Semantic Descriptors
summary: The immutable metadata contract between builders and the compiler.
order: 30
---

Every public builder exists to produce a semantic descriptor. Descriptors are the compile-time representation that later compiler phases can normalize, validate and transform into generated artifacts.

Descriptors intentionally store references and names, not runtime instances. This preserves Smite's zero-cost runtime boundary.

## Descriptor merging

Merging is a compiler concern. Builders only expose immutable metadata that can be combined deterministically.

@example Descriptor merging

## Tested documentation

Documentation examples are extracted from test files. A concept page or JSDoc entry can reference an example by title with `@example`, and the documentation build fails if the snippet does not exist.
