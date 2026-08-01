---
title: Event Builders
summary: Build the inputs that handleified functions consume.
order: 45
---

Event builders construct the invocation data consumed by handleified functions: an HTTP request, a messaging message or a cron event. They keep the data you pass in separate from the function you call.

Only the fields you need are required. Every builder ends with `build`.

## Requests

A request defaults to `GET /` with no headers, cookies, query or body.

@example Build a request

## Messages

A message carries an optional identifier, routing attributes and payload.

@example Build a message

## Scheduled jobs

A cron event carries when the job fired and defaults to the current time. Handleified jobs accept the event as their input.

@example Build a cron event
