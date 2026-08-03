---
title: The generated API
summary: The builder tree that mirrors your routes.
order: 20
---

The generated module exports `api`, a nested builder that mirrors your routes:
one level per path segment, leaf calls per HTTP method. What you type at the
call site is constrained by what you declared.

## Paths become nesting

`/users/:id` becomes `api.users.$id`. Path parameters are prefixed with `$` to
avoid colliding with method names and resource segments. Each leaf exposes
`$get`, `$post`, `$put`, `$delete`, ... matching the declared methods.

## Calls take a bucket

Every call accepts one input object with typed `params`, plus loose `query`,
`headers`, `body`, and `$config` buckets. Path params are required and inferred
from the path template; missing params throw a descriptive error at runtime.

## Responses never throw on non-2xx

Each call resolves to `{ status, body, headers }`. A `404` is a resolved value,
not an exception — the caller decides what an error status means.