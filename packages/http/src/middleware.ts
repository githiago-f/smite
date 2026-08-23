import { registerLogger } from "@smitejs/core";
import { pino } from "pino";
import type { Logger } from "pino";
import { aspect } from "./aspects.js";
import type { HttpAspect, HttpMiddlewareContext } from "./aspects.js";
import type { HttpResponse } from "./types.js";

/**
 * Composes pipeline stages into the core `handler`, left-to-right. Each stage
 * receives `ctx` and a `next` that runs the remainder of the chain; the
 * returned value becomes the eventual {@link HttpResponse}. Stages may be
 * middleware or interceptors — both share the `(ctx, next)` shape.
 *
 * @group Aspects
 */
export function compose(
  stages: readonly ((
    ctx: HttpMiddlewareContext,
    next: () => Promise<HttpResponse>,
  ) => unknown | Promise<unknown>)[],
  handler: (ctx: HttpMiddlewareContext) => Promise<HttpResponse>,
): (ctx: HttpMiddlewareContext) => Promise<HttpResponse> {
  const run = (
    index: number,
  ): ((ctx: HttpMiddlewareContext) => Promise<HttpResponse>) => {
    const stage = stages[index];
    if (stage === undefined) return handler;
    return (ctx) =>
      stage(ctx, () => run(index + 1)(ctx)) as Promise<HttpResponse>;
  };
  return (ctx) => run(0)(ctx);
}

/**
 * Options for the built-in request logger aspect.
 *
 * @group Aspects
 */
export interface RequestLoggerOptions {
  /** pino level filter. @default "info" */
  readonly level?: string;
  /** Extra `base` fields merged into every log line of the request scope. */
  readonly base?: Readonly<Record<string, unknown>>;
}

/**
 * The request-scoped pino logger populated by {@link requestLogger}. Read it
 * anywhere inside the request through {@link currentLogger}; it carries the
 * request context under `base` so logs are traceable.
 *
 * @group Aspects
 */
export type RequestLogger = Logger;

/**
 * Returns the pino logger for the current request (the one created by
 * {@link requestLogger}), or `undefined` when no logging aspect ran.
 *
 * @group Aspects
 */
export function currentLogger(): RequestLogger | undefined {
  return registerLogger(
    (context) => context?.logger as RequestLogger | undefined,
  );
}

/**
 * Logging aspect for incoming requests. It reads the active
 * {@link @smitejs/core} scope, builds a request-scoped pino logger from that
 * context via {@link registerLogger}, and logs the request and its response
 * (status + duration). Handlers and later stages obtain the same logger with
 * {@link currentLogger}. Apply it with `app.use(requestLogger(...))`.
 *
 * @group Aspects
 * @example Log every request
 */
export function requestLogger(options?: RequestLoggerOptions): HttpAspect {
  const level = options?.level ?? "info";
  return aspect.middleware(async (ctx: HttpMiddlewareContext, next) => {
    const start = Date.now();
    const logger = registerLogger((context) =>
      pino({
        level,
        base: {
          ...options?.base,
          request: context?.request ?? ctx.request,
        },
      }),
    );
    ctx.scope.logger = logger;
    const response = (await next()) as HttpResponse;
    logger.info(
      {
        method: ctx.request.method,
        path: ctx.request.path,
        status: response.status,
        durationMs: Date.now() - start,
      },
      "request complete",
    );
    return response;
  });
}
