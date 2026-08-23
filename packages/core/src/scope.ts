import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The request-scoped context attached to a single execution unit (an HTTP
 * request handler, a domain job, ...). It is carried across async boundaries
 * by an {@link AsyncLocalStorage} so that code deep in a call stack can read
 * the intent that spawned it. Mutable: middleware may stash shared values
 * (a logger, a tracer) on it for the rest of the call stack to read.
 *
 * @group Scope
 */
export type ScopeContext = Record<PropertyKey, unknown>;

const storage = new AsyncLocalStorage<ScopeContext>();

/**
 * Marks the start of an execution unit, propagating `context` through
 * {@link currentScope} for the duration of `run` (synchronously and across
 * every awaited promise; it spawns). Returns whatever `run` returns.
 *
 * @group Scope
 * @example Scope a request handler
 */
export function runWithScope<T>(context: ScopeContext, run: () => T): T {
  return storage.run(context, run);
}

/**
 * Returns the context of the innermost enclosing execution unit, or
 * `undefined` when no scope is active.
 *
 * @group Scope
 */
export function currentScope(): ScopeContext | undefined {
  return storage.getStore();
}

/**
 * Builds a request-scoped dependency (a logger, tracer, ...) by reading the
 * active {@link currentScope} context and passing it to `build`. Because the
 * scope is an {@link AsyncLocalStorage}, `build` may be invoked synchronously
 * and still observe the request it belongs to.
 *
 * @group Scope
 * @example Register a request-scoped logger
 */
export function registerLogger<T>(
  build: (context: ScopeContext | undefined) => T,
): T {
  return build(currentScope());
}
