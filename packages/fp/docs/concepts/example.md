---
title: Example
summary: Option, Result, Task, chain, and flow in a request-handling script.
order: 99
---

`examples/fp-utils` puts the primitives together in one small script: `Option`
for an optional query param, `Task` for a lazy async load, `TaskResult` for a
fallible step, `chain` to extract a token, `Matcher` to branch on the result,
and `flow` to compose a pipeline. Run it with
`yarn workspace @smitejs/example-fp-utils start`.