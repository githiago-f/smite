import { usecaseDescriptorSymbol } from "./usecase.js";
import type { Usecase } from "./usecase.js";

/**
 * Non-enumerable symbol carried by functions produced by {@link handler} and by
 * usecase runners. Transport builders read it (via `Symbol.for` with the same
 * string) to relate an `http.handler` node to the underlying `domain.usecase`
 * node in collect mode — without a package dependency between the two.
 *
 * @group Internals
 */
export const domainHandlerSymbol: unique symbol = Symbol.for(
  "@smite/domain/handler",
);

/**
 * Metadata attached to a handler function referencing the usecase it runs.
 *
 * @group Internals
 */
export type DomainHandlerMetadata = {
  readonly usecaseNode: unknown;
  readonly deps: Readonly<Record<string, unknown>>;
};

/**
 * The structural context a domain handler reads. Compatible with the context a
 * transport provides.
 *
 * @group Types
 */
export interface HandlerContext {
  readonly body?: unknown;
  readonly params?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, unknown>>;
}

/**
 * The structural response a domain handler returns.
 *
 * @group Types
 */
export interface HandlerOutput {
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * Options for {@link handler}.
 *
 * @group Types
 */
export interface HandlerOptions<Input> {
  readonly input?: (ctx: HandlerContext) => Input;
  readonly status?: number;
  readonly errorStatus?: number;
}

/**
 * A transport handler that runs a usecase against injected deps and maps the
 * `Result` to a response: `ok` becomes the configured success (200 by default),
 * failures become a configurable error status (422 by default) with the reason
 * in the body. Carries non-enumerable metadata the transport relates to the
 * usecase IR node in collect mode.
 *
 * @group Builders
 * @example Wire a usecase to a handler
 */
export function handler<Deps, Input, Output, ErrorValue>(
  usecase: Usecase<Deps, Input, Output, ErrorValue>,
  deps: Deps,
  options: HandlerOptions<Input> = {},
): (ctx: HandlerContext) => Promise<HandlerOutput> {
  const selectInput =
    options.input ?? ((ctx: HandlerContext) => ctx.body as Input);

  const fn = async (ctx: HandlerContext): Promise<HandlerOutput> => {
    const result = await usecase.run(selectInput(ctx), deps).run();
    return result.match(
      (value) => ({ status: options.status ?? 200, body: value }),
      (error) => ({ status: options.errorStatus ?? 422, body: { error } }),
    );
  };

  const metadata: DomainHandlerMetadata = {
    usecaseNode: usecase[usecaseDescriptorSymbol],
    deps: deps as unknown as Readonly<Record<string, unknown>>,
  };
  Object.defineProperty(fn, domainHandlerSymbol, {
    configurable: false,
    enumerable: false,
    value: metadata,
  });

  return fn;
}
