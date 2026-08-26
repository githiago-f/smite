import { runWithScope, registerLogger } from "@smitejs/core";
import { pino } from "pino";
import type { Logger as PinoLogger } from "pino";

/**
 * Generic structured logger interface.
 * Implementations must be pure (no side effects beyond I/O) and
 * transport-agnostic so callers are not coupled to pino internally.
 */
export interface Logger {
  /** Log at `info` level. */
  info(msg: string, ...meta: unknown[]): void;
  /** Log at `warn` level. */
  warn(msg: string, ...meta: unknown[]): void;
  /** Log at `error` level. */
  error(msg: string, ...meta: unknown[]): void;
  /** Log at `debug` level. */
  debug(msg: string, ...meta: unknown[]): void;
  /** Log at `trace` level. */
  trace(msg: string, ...meta: unknown[]): void;
}

/**
 * Creates a pino-backed Logger implementing the generic interface.
 * The resulting logger is automatically scope-anchored: it reads the active
 * scope and pins itself to it via registerLogger, so that any code in the same
 * async context can retrieve it with currentLogger.
 *
 * @group Logger
 * @example Create a scope-anchored logger
 */
export function createLogger(options) {
  const level = options?.level ?? "info";
  const base = options?.base ?? {};

  const pinoLogger = pino({ level, base });

  return {
    info: (msg, ...meta) => pinoLogger.info(msg, ...meta),
    warn: (msg, ...meta) => pinoLogger.warn(msg, ...meta),
    error: (msg, ...meta) => pinoLogger.error(msg, ...meta),
    debug: (msg, ...meta) => pinoLogger.debug(msg, ...meta),
    trace: (msg, ...meta) => pinoLogger.trace(msg, ...meta),
  };
}

/**
 * Registers a logger into the current scope so that currentLogger() can
 * retrieve it later. Caller must ensure a scope is active (e.g. via
 * {@link runWithScope}).
 *
 * @group Logger
 * @example Register and retrieve a logger in a scope
 */
export function registerScopeLogger(logger) {
  registerLogger((context) => {
    context!.logger = logger;
  });
}

/**
 * Returns the logger that was registered for the current scope, or undefined
 * when no logger has been registered.
 *
 * @group Logger
 * @example Retrieve a logger from the current scope
 */
export function currentLogger() {
  return registerLogger(
    (context) => context?.logger as Logger | undefined,
  );
}

/**
 * Runs a callback with a scope-anchored logger. The logger is registered into
 * the scope for the duration of run, and is automatically cleaned up after.
 *
 * @group Logger
 * @example Run with a scoped logger
 */
export function runWithLogger(options, run) {
  const logger = createLogger(options);
  return runWithScope({}, (): unknown => {
    registerLogger((context) => {
      context!.logger = logger;
    });
    return run();
  });
}

/**
 * Creates a logger that is scoped to a custom context. The logger is registered
 * into a new scope via runWithScope and retrieved via currentLogger within that
 * scope.
 *
 * @group Logger
 * @example Create a logger for a job execution
 */
export function createScopedLogger(context, options) {
  const logger = createLogger(options);
  registerLogger((ctx) => {
    ctx.logger = logger;
  });
  return logger;
}

/**
 * The kind of an aspect: which stage of the pipeline it runs at.
 */
export const HttpAspectKind = {
  MIDDLEWARE: "middleware",
  GUARD: "guard",
  INTERCEPTOR: "interceptor",
  FILTER: "filter",
} as const;
/** @internal */
export function aspect(kind, fn) {
  return { kind, fn };
}

/**
 * Creates an AOP aspect middleware that provides a scope-anchored logger.
 * The aspect wraps the pipeline and makes the logger available via currentLogger().
 *
 * @group Aspects
 * @example Apply a logger aspect
 */
export function jobLogger(options) {
  const level = options?.level ?? "info";
  const base = options?.base ?? {};

  const fn = aspect(HttpAspectKind.MIDDLEWARE, async (ctx, next) => {
    let logger = ctx.logger;

    if (!logger) {
      logger = createLogger({ level, base });
      registerScopeLogger(logger);
    }

    ctx.logger = logger;
    const response = await next();
    logger.info("job/middleware step complete");
    return response;
  });

  return fn;
}

/**
 * Creates an AOP aspect middleware for job execution.
 * Creates a logger scoped to the job context and makes it available via
 * currentLogger throughout the job's async lifecycle.
 *
 * @group Aspects
 * @example Apply logger aspect to a job
 */
export function jobExecutionLogger(options) {
  const level = options?.level ?? "info";
  const base = options?.base ?? {};
  const label = options?.label ?? "job";

  const fn = aspect(HttpAspectKind.MIDDLEWARE, async (ctx, next) => {
    const logger = createLogger({ level, base });
    registerScopeLogger(logger);

    ctx.logger = logger;
    ctx.label = label;

    const response = await next();
    logger.info({ label, status: "complete" }, "job execution complete");
    return response;
  });

  return fn;
}

/**
 * Creates an AOP guard aspect that short-circuits the pipeline on handler error,
 * logging the error before returning a 500 response.
 *
 * @group Aspects
 * @example Error-handling guard aspect
 */
export function errorLoggingGuard(options) {
  const level = options?.level ?? "error";

  const fn = aspect(HttpAspectKind.GUARD, async (ctx, next) => {
    const logger = currentLogger();
    if (logger) {
      try {
        const response = await next();
        return response;
      } catch (err) {
        logger.error({ err }, "handler error, short-circuiting");
        return {
          status: 500,
          body: { error: "internal error" },
        };
      }
    }
    return next();
  });

  return fn;
}

/**
 * Creates an AOP aspect middleware that logs entry and exit of a callback,
 * registering a scope-anchored logger.
 *
 * @group Aspects
 * @example Log around a function call
 */
export function aroundLogger(options) {
  const level = options?.level ?? "info";
  const base = options?.base ?? {};

  const fn = aspect(HttpAspectKind.MIDDLEWARE, async (ctx, next) => {
    const logger = createLogger({ level, base });
    registerScopeLogger(logger);

    const start = Date.now();
    const result = await next();
    logger.info(
      { durationMs: Date.now() - start },
      "around logger complete",
    );
    return result;
  });

  return fn;
}