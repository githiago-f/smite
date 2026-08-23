type MaybePromise<Value> = PromiseLike<Value> | Value;

/**
 * The trigger a zero-input handler receives: the node `name` that fired it and
 * the epoch millis `at` it fired.
 *
 * @group Signal
 */
export interface EmptySignal {
  readonly name: string;
  readonly at: number;
}

/**
 * A handler that needs no request or message input — it runs off a bare
 * {@link EmptySignal}. The base shape shared by scheduled jobs and realtime
 * lifecycle events (connect / disconnect).
 *
 * @group Types
 * @example Handle zero-input events
 */
export type EmptyHandler<Output = unknown> = (
  signal: EmptySignal,
) => MaybePromise<Output>;

/**
 * Non-enumerable symbol under which {@link emptyHandler} stores its metadata.
 * Artifact generators read it (via `Symbol.for`) to trace a zero-input handler
 * back to the run node it belongs to.
 *
 * @group Internals
 */
export const emptyHandlerSymbol: unique symbol = Symbol.for(
  "@smitejs/handlers/emptyHandler",
);

/**
 * Metadata attached to a function by {@link emptyHandler}.
 *
 * @group Internals
 */
export interface EmptyHandlerMetadata {
  readonly name: string;
}

/**
 * A function with optional empty-handler metadata attached.
 *
 * @group Types
 */
export type EmptyHandlerFn<Output = unknown> = EmptyHandler<Output> & {
  readonly [emptyHandlerSymbol]?: EmptyHandlerMetadata;
};

/**
 * Tags a zero-input handler with a name so artifact generators can relate it to
 * the descriptor node it belongs to. Returns the same function; the metadata is
 * non-enumerable and never serialized.
 *
 * @group Builders
 * @example Define a zero-input handler
 */
export function emptyHandler<Output = unknown>(
  metadata: EmptyHandlerMetadata,
  fn: EmptyHandler<Output>,
): EmptyHandlerFn<Output> {
  Object.defineProperty(fn, emptyHandlerSymbol, {
    configurable: false,
    enumerable: false,
    value: Object.freeze({ name: metadata.name }),
  });
  return fn as EmptyHandlerFn<Output>;
}

/**
 * Reads the metadata attached by {@link emptyHandler}, if any.
 *
 * @group Builders
 * @example Read zero-input handler metadata
 */
export const metadataOf = (fn: unknown): EmptyHandlerMetadata | undefined => {
  if (typeof fn !== "function") return undefined;
  return (fn as EmptyHandlerFn)[emptyHandlerSymbol];
};

/**
 * Builds the {@link EmptySignal} that a scheduler or lifecycle dispatcher hands
 * to a zero-input handler.
 *
 * @group Builders
 * @example Fire a zero-input handler
 */
export function fire(
  name: string,
  at: number | Date = Date.now(),
): EmptySignal {
  return Object.freeze({
    name,
    at: typeof at === "number" ? at : at.getTime(),
  });
}

/**
 * The handlers namespace: the zero-input handler type kit shared by the
 * {@link @smitejs/jobs} and {@link @smitejs/realtime} app extensors.
 *
 * @group Surface
 */
export const handlers = {
  emptyHandler,
  fire,
  metadataOf,
};
