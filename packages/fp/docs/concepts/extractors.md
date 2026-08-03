---
title: Extractors
summary: Reading optional values from a source, with inspectable metadata.
order: 80
---

An extractor is `(source) => Option<Value>` — a function that reads an optional
value from a source and reports absence explicitly instead of with `undefined`.
Transport builders (cookies, headers, params, query) produce them, and `chain`
composes them.

## Reading a value

The canonical example is a request-like source: read a cookie, a header, a
query param — each returns an `Option`, so a missing value is an explicit
`none`, never a crash.

@example Extract a cookie value

## chain — try in order

`chain(...extractors)` tries each extractor in order and returns the first
value found, or `none` if all miss. Order matters: prefer more specific or more
secure sources first (an authenticated header before a session cookie).

@example Chain cookie and header extractors

## Metadata

Extractors produced by `chain` (and transport factories) carry a non-enumerable
`extractorMetadata` symbol describing their `source` and `key`. Tooling reads it
with `getExtractorMetadata` without executing the extractor — and normal
iteration and serialization never see it.

@example Extractor metadata