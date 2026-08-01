---
title: Applications
summary: Compose transport intent and execute it as plain functions.
order: 50
---

An application is described as intent: routes, controllers, jobs and the policy that guards them. `handleify` turns that intent into plain functions, and event builders feed those functions the data they consume.

Nothing starts a server, registers handlers globally or constructs a runtime pipeline. Every piece is an ordinary value you can export, reuse and hand to any runtime adapter.

## Describe the intent

Routes declare a method, a path and a handler. Controllers group routes under a path and share lifecycle policy. Jobs describe scheduled work.

@example Compose an application

## Extract request values

Extractors return `Option<string>`, so a missing value is explicit instead of a crash. `chain` from `@smite/fp` tries sources in order — here a Bearer token header before a session cookie, and a path parameter before a query string.

## Enforce policy

Guards run before the handler and deny execution when the request does not match. A denied controller request resolves to a `403` result and the handler never runs.

## Turn intent into functions

`handleify` returns a plain async function per descriptor. A controller becomes a request-to-result function, a job becomes a zero-argument function. Runtimes and scripts call the same functions.

## Invoke with events

Event builders construct the invocation data: a request, a message or a cron event. They keep the data separate from the function being called.

@example Execute the application
