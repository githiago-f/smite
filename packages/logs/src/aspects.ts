import { registerLogger, ScopeContext } from "@smitejs/core";
import { createLogger } from "./logger.js";

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
export type HttpAspectKind = keyof typeof HttpAspectKind;

/**
 * A pipeline stage that wraps the remainder of the chain.
 */
export type HttpMiddleware = (
  ctx: { scope: ScopeContext },
  next: () => Promise unknown,
) => unknown | Promise<unknown>;

/**
 * A request gate that may short-circuit with a response.
 */
export type HttpGuard = (
  ctx: { scope: ScopeContext },
) => unknown | undefined | Promise<unknown | undefined>;

/**
 * An outer wrapper around the whole pipeline that can rewrite the final response.
 */
export type HttpInterceptor = (
  ctx: { scope: ScopeContext },
  next: () => Promise unknown,
) => unknown | Promise<unknown>;

/**
 * A response post-processor running after the handler.
 */
export type HttpFilter = (
  response: unknown,
  ctx: { scope: ScopeContext },
) => unknown | Promise<unknown>;

/**
 * A named pipeline stage registered on an app via `app.use`.
 * Built with the `aspect` factory and stored as an `http.aspect` IR node on the app.
 */
export interface HttpAspect {
  /** @internal */
  kind: HttpAspectKind;
  /** @internal */
  fn: HttpMiddleware | HttpGuard | HttpInterceptor | HttpFilter;
}

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
    let logger = ctx.scope.logger;

    if (!logger) {
      logger = createLogger({ level, base });
      registerLogger((context) => {
        context.logger = logger;
      });
    }

    ctx.scope.logger = logger;
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
    registerLogger((context) => {
      context.logger = logger;
      context.label = label;
    });

    ctx.scope.logger = logger;
    ctx.scope.label = label;

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
    registerLogger((context) => {
      context.logger = logger;
    });

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