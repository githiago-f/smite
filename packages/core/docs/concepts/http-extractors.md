---
title: HTTP Extractors
summary: Read optional request values from typed sources.
order: 30
---

HTTP extractors describe where a value should be read from an HTTP request. They return `Option<string>` so missing values stay explicit instead of throwing.

Extractors are produced by the `http` namespace and composed with `chain` from `@smite/fp`. They carry non-enumerable metadata describing their source, which compiler and security tooling can inspect.

## Cookies

Cookies are read from the normalized `request.cookies` map populated by runtime adapters.

@example Extract a cookie

## Headers

Header lookup is case-insensitive, so `http.header("X-API-Key")` and `http.header("x-api-key")` behave the same.

@example Extract a header

## Query parameters

Only string query values are extracted.

@example Extract a query parameter

## Path parameters

Path parameters are read from the route parameters.

@example Extract a path parameter

## Authorization header

Pass a scheme to read the token after the scheme. Without a scheme, the raw header value is returned.

@example Extract an authorization scheme

## Custom extractors

When a built-in source does not fit, `http.custom` accepts any reader over the execution context.

@example Custom extractor

## Composition

Use `chain` from `@smite/fp` to try sources in order. Order matters: prefer more secure sources first.

@example Compose extractors with chain

## Extractors in lifecycle components

Every lifecycle component implementation receives the `HttpExecutionContext`, so extractors compose directly inside guards, filters, providers, pipes and interceptors. `chain` keeps a single field readable across multiple sources.

### Guards

Guards receive the context and return whether execution may continue.

@example Extract in a guard

### Filters

Filters receive the captured error and the current context, so they can read request values while handling failures.

@example Extract in a filter

### Providers

Providers receive the context and their return value is stored in `context.state`, seeding downstream handlers.

@example Extract in a provider

### Pipes

Pipes receive the request body and the context, letting an extractor attach request-derived fields to the body.

@example Extract in a pipe

### Interceptors

Interceptors receive the context for side effects such as audit logging.

@example Extract in an interceptor
