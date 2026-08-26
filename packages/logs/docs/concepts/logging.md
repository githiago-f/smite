---
order: 01
title: Logging
summary: Structured logging cross-cutting concern for Smite applications
---

# Smite.js Logging

The `@smitejs/logs` package provides a generic structured logging abstraction that
integrates with Smite's cross-cutting concern mechanisms. It is transport-agnostic
and scope-anchored, meaning loggers are tied to the current execution context via
`AsyncLocalStorage` and are automatically available anywhere in the same async
boundary.

## Core Concepts

### Scope-anchored loggers

Loggers are not standalone objects — they are registered into the current
`@smitejs/core` scope via `registerLogger`. This means:

- A logger created in one part of the codebase is automatically available in
  deeply nested async calls within the same boundary.
- `currentLogger()` retrieves the logger for the current scope, or `undefined`
  if none has been registered.
- `runWithLogger(options, run)` creates a logger, registers it, runs a callback,
  and cleans up after.

### Transport-agnostic interface

The public `Logger` interface is independent of any specific backend:

```const logger = logs.createLogger({ level: "info" });
logger.info("Application started");
logger.warn("Configuration warning", { config: process.env.FEATURE });
logger.error("Database connection failed", { error: err });
```

The underlying implementation uses `pino`, but the interface contracts do not
expose pino types. This allows swapping the transport (pino → winston → bunyan)
without changing consumer code.

## Built-in AOP Aspects

The package provides ready-to-use aspects for common cross-cutting logging
scenarios:

### `logs.jobLogger(options)`

A middleware aspect that provides a scope-anchored logger throughout the
pipeline. If no logger exists in the scope, one is created with the given
options and registered.

Use as: `app.use(logs.jobLogger({ level: "debug" }))`

### `logs.jobExecutionLogger(options)`

A middleware aspect that creates a logger scoped to a job execution context.
It also stores a `label` in the scope for identification.

Use as: `app.use(logs.jobExecutionLogger({ label: "order-processing" }))`

### `logs.errorLoggingGuard(options)`

A guard aspect that short-circuits the pipeline on handler error, logging the
error before returning a 500 response.

Use as: `app.use(logs.errorLoggingGuard())`

### `logs.aroundLogger(options)`

A middleware aspect that logs the duration of the pipeline run, from entry to
exit.

Use as: `app.use(logs.aroundLogger({ level: "trace" }))`

## Usage Patterns

### HTTP Request Logging (beyond the built-in requestLogger)

The built-in `http.requestLogger()` from `@smitejs/http` already provides request
scoped logging for HTTP. Use `@smitejs/logs` when you need logging that spans
across multiple contexts (HTTP + jobs + messaging, for example):

```import { app } from "@smitejs/http";
import { logs } from "@smitejs/logs";

// HTTP request logger (built-in)
app.use(http.requestLogger());

// Cross-context logger for the whole app
app.use(logs.aroundLogger({ level: "info" }));
```

### Job Logging

```import { job } from "@smitejs/jobs";
import { logs } from "@smitejs/logs";

const orderProcessing = job()
  .on("start", () => {
    // Logger is available via currentLogger() inside the job
    const logger = logs.currentLogger();
    logger.info("Order job started", { orderId });
  })
  .run();
```

### Scope Integration

```import { runWithScope, logs } from "@smitejs/core";

runWithScope({ jobId: "123" }, () => {
  const logger = logs.currentLogger() ?? logs.createLogger({ level: "info" });
  logs.registerScopeLogger(logger);
  logger.info("Processing job", { jobId: "123" });
});
```