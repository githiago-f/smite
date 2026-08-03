---
title: Building responses
summary: Shaping the response value with json and status.
order: 40
---

A handler returns a plain value; `serve` turns it into an HTTP response. Smite
models a response as `{ status, body, headers? }`, and the two helpers build
that shape without ceremony.

## json

`json(body, status = 200)` produces `{ status, body }`. It is the default way
to answer with a payload.

## status(...).json

`status(201).json({ id: "42" })` is the two-step variant when the status is the
interesting part. It reads like a sentence: "status 201, body this".

@example Build response bodies

## What serve accepts

A handler may return either a full `HttpResponse` (anything with a `status`
property) or a bare value. Bare values are wrapped as `{ status: 200, body:
value }`. `serve` also normalizes the `HttpStatus` constants (`OK`, `CREATED`,
`BAD_REQUEST`, `NOT_FOUND`, `INTERNAL_SERVER_ERROR`) for readability in code
that wants named statuses.