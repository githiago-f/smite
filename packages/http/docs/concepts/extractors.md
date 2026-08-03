---
title: Extractors
summary: Reading cookie, header, param, and query values off a request.
order: 60
---

Fiber-from-Go style extractors read an optional value off the `HttpRequest` and
report absence explicitly as `none` instead of a crash. `http.cookies`,
`http.headers`, `http.params`, and `http.query` each produce an
`Extractor<HttpRequest, string>`, and `http.chain` tries several in order.

## Reading a value

Pick the source matching where the value lives. Every extractor returns an
`Option<string>` — absent means `none`, never `undefined`.

@example Chain extractors over a request

## chain — try in order

`chain(...extractors)` tries each extractor in order and returns the first
value found. Prefer more specific or more secure sources first (an
authenticated header before a session cookie).

## Metadata

Every extractor carries non-enumerable `fp.extractor` metadata describing its
`source` (`cookie`, `header`, `param`, `query`) and `key`. Read it with
`http.getExtractorMetadata` for tooling without executing the extractor.