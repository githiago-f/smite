import { childrenOf, defineDescriptor, relate } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import type { ScopeContext } from "@smitejs/core";
import type { HttpRequest, HttpResponse } from "./types.js";

/**
 * The request-scoped context handed to middleware, guards, and interceptors:
 * the raw request plus the mutable request {@link ScopeContext} carried by
 * `@smitejs/core` `runWithScope`. Stash shared values (a logger, a tracer) on
 * `scope` for the rest of the call stack to read.
 *
 * @group Aspects
 */
export interface HttpMiddlewareContext {
  readonly request: HttpRequest;
  readonly scope: ScopeContext;
}

/**
 * A pipeline stage that wraps the remainder of the chain: it runs `next()`
 * (or short-circuits) around the following stages and the matched route
 * handler. The returned value is the eventual {@link HttpResponse}.
 *
 * @group Aspects
 */
export type HttpMiddleware = (
  ctx: HttpMiddlewareContext,
  next: () => Promise<unknown>,
) => unknown | Promise<unknown>;

/**
 * A request gate: returns a response to short-circuit the pipeline (a `401`
 * for an unauthenticated call, say) or `undefined`/`void` to continue into
 * the handler.
 *
 * @group Aspects
 */
export type HttpGuard = (
  ctx: HttpMiddlewareContext,
) => HttpResponse | undefined | Promise<HttpResponse | undefined>;

/**
 * An outer wrapper around the whole pipeline: like middleware, but it always
 * resolves the final {@link HttpResponse}, so it can observe and rewrite the
 * response on the way out (timing, tracing headers, error mapping).
 *
 * @group Aspects
 */
export type HttpInterceptor = (
  ctx: HttpMiddlewareContext,
  next: () => Promise<HttpResponse>,
) => HttpResponse | Promise<HttpResponse>;

/**
 * A response post-processor: receives the response produced by the handler
 * (after validation and dispatch) and returns the response that is actually
 * served. Filters run after guards, middleware, interceptors, and the handler.
 *
 * @group Aspects
 */
export type HttpFilter = (
  response: HttpResponse,
  ctx: HttpMiddlewareContext,
) => HttpResponse | Promise<HttpResponse>;

/**
 * The kind of an {@link HttpAspect}: which stage of the request pipeline it
 * runs at.
 *
 * @group Aspects
 */
export const HttpAspectKind = {
  MIDDLEWARE: "middleware",
  GUARD: "guard",
  INTERCEPTOR: "interceptor",
  FILTER: "filter",
} as const;
export type HttpAspectKind =
  (typeof HttpAspectKind)[keyof typeof HttpAspectKind];

/**
 * A named pipeline stage registered on an app via `app.use`. Built with the
 * {@link aspect} factory and stored as an `http.aspect` IR node on the app.
 *
 * @group Aspects
 */
export interface HttpAspect {
  readonly kind: HttpAspectKind;
  readonly fn: HttpMiddleware | HttpGuard | HttpInterceptor | HttpFilter;
}

/** A request pipeline stage: `(ctx, next) => response`. @group Aspects */
export interface HttpAspectDescriptor
  extends Descriptor<
    "http.aspect",
    { readonly kind: HttpAspectKind; readonly fn: HttpAspect["fn"] }
  > {}

/** Aspect factory: labels plain functions as pipeline stages. @group Aspects
 * @example Apply AOP aspects
 */
export const aspect = {
  /** A pre-handler stage that wraps the remaining chain. */
  middleware: (fn: HttpMiddleware): HttpAspect => ({
    kind: HttpAspectKind.MIDDLEWARE,
    fn,
  }),
  /** A gate that may short-circuit with a response before the handler runs. */
  guard: (fn: HttpGuard): HttpAspect => ({
    kind: HttpAspectKind.GUARD,
    fn,
  }),
  /** An outer wrapper that can rewrite the final response. */
  interceptor: (fn: HttpInterceptor): HttpAspect => ({
    kind: HttpAspectKind.INTERCEPTOR,
    fn,
  }),
  /** A response post-processor running after the handler. */
  filter: (fn: HttpFilter): HttpAspect => ({ kind: HttpAspectKind.FILTER, fn }),
};

/** Registers an aspect as an `http.aspect` child of an app. @group Aspects */
export function addAspect(
  app: AppDescriptor,
  entry: HttpAspect,
): HttpAspectDescriptor {
  const descriptor = defineDescriptor(
    "http.aspect",
    `${app.__key}:http.aspect:${childrenOf(app, "http.aspect").length}`,
    { kind: entry.kind, fn: entry.fn },
  ) as HttpAspectDescriptor;
  relate(app, "http.aspect", descriptor);
  return descriptor;
}

/** The aspects registered on an app, in order. @group Aspects */
export function aspectsOf(app: AppDescriptor): readonly HttpAspect[] {
  return childrenOf(app, "http.aspect").map(
    (node) => (node as HttpAspectDescriptor).data,
  );
}
