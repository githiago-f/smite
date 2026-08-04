import { defineDescriptor } from "@smitejs/core";
import type { Descriptor } from "@smitejs/core";
import { TaskResult } from "@smitejs/fp";
import type { Result } from "@smitejs/fp";
import type { z } from "zod";

/**
 * Whether a usecase mutates state (`command`) or only reads it (`query`).
 *
 * @group Types
 */
export type UsecaseKind = "command" | "query";

/**
 * A built-in failure: invalid input, or a dependency the injected deps lacked.
 *
 * @group Types
 */
export type DomainFailure =
  | { readonly tag: "domain.validation"; readonly data: readonly z.ZodIssue[] }
  | {
      readonly tag: "domain.deps";
      readonly data: { readonly missing: readonly string[] };
    };

/**
 * A `domain.usecase` IR node.
 *
 * @group Internals
 */
export interface UsecaseDescriptor<Input>
  extends Descriptor<
    "domain.usecase",
    {
      readonly name: string;
      readonly kind: UsecaseKind;
      readonly inputSchema?: z.ZodType<Input>;
      readonly deps: readonly string[];
    }
  > {}

type MaybePromise<Value> = PromiseLike<Value> | Value;

/**
 * Config for {@link usecase}.
 *
 * @group Types
 */
export interface UsecaseConfig<Deps, Input, Output, ErrorValue = unknown> {
  readonly name: string;
  readonly kind?: UsecaseKind;
  readonly input?: z.ZodType<Input>;
  readonly deps?: readonly (keyof Deps & string)[];
  readonly handle: (
    deps: Deps,
    input: Input,
  ) => MaybePromise<Result<Output, ErrorValue>>;
}

/**
 * Non-enumerable symbol under which a usecase stores its IR node, read by the
 * {@link handler} glue to relate an http handler to the usecase edge.
 *
 * @group Internals
 */
export const usecaseDescriptorSymbol: unique symbol = Symbol.for(
  "@smitejs/domain/usecaseDescriptor",
);

/**
 * A usecase: a named, pure command/query returning a `TaskResult`.
 *
 * @group Types
 */
export interface Usecase<Deps, Input, Output, ErrorValue = unknown> {
  readonly name: string;
  readonly kind: UsecaseKind;
  readonly id: string;
  readonly run: (
    input: Input,
    deps: Deps,
  ) => TaskResult<Output, ErrorValue | DomainFailure>;
  readonly with: (
    deps: Deps,
  ) => (input: Input) => TaskResult<Output, ErrorValue | DomainFailure>;
  readonly [usecaseDescriptorSymbol]?: UsecaseDescriptor<Input>;
}

/**
 * Builds a pure usecase. `handle(deps, input)` is the functional core and
 * returns a `Result` (sync or async); all I/O happens in the injected `deps`
 * (ports). Invalid input returns a `domain.validation` failure instead of
 * throwing. In collect mode a `domain.usecase` node is registered.
 *
 * @group Builders
 * @example Define a usecase
 * @example Bind dependencies to a usecase
 */
export function usecase<Deps, Input, Output, ErrorValue = unknown>(
  config: UsecaseConfig<Deps, Input, Output, ErrorValue>,
): Usecase<Deps, Input, Output, ErrorValue> {
  const kind = config.kind ?? "command";
  const descriptor = defineDescriptor("domain.usecase", config.name, {
    name: config.name,
    kind,
    inputSchema: config.input,
    deps: config.deps ?? [],
  });

  const execute = (
    input: Input,
    deps: Deps,
  ): TaskResult<Output, ErrorValue | DomainFailure> => {
    if (config.deps !== undefined) {
      const missing = config.deps.filter(
        (key) =>
          (deps as unknown as Record<string, unknown>)[key] === undefined,
      );
      if (missing.length > 0) {
        return TaskResult.err<ErrorValue | DomainFailure, Output>({
          tag: "domain.deps",
          data: { missing },
        });
      }
    }

    if (config.input !== undefined) {
      const parsed = config.input.safeParse(input);
      if (!parsed.success) {
        return TaskResult.err<ErrorValue | DomainFailure, Output>({
          tag: "domain.validation",
          data: parsed.error.issues,
        });
      }
      return fromHandle(config.handle, deps, parsed.data);
    }

    return fromHandle(config.handle, deps, input);
  };

  const asUsecase: Usecase<Deps, Input, Output, ErrorValue> = {
    name: config.name,
    kind,
    id: config.name,
    run: execute,
    with: (deps) => (input) => execute(input, deps),
  };
  Object.defineProperty(asUsecase, usecaseDescriptorSymbol, {
    configurable: false,
    enumerable: false,
    value: descriptor,
  });
  return asUsecase;
}

const fromHandle = <Deps, Input, Output, ErrorValue, Failure>(
  handle: UsecaseConfig<Deps, Input, Output, ErrorValue>["handle"],
  deps: Deps,
  input: Input,
): TaskResult<Output, ErrorValue | Failure> =>
  TaskResult.from<Output, ErrorValue | Failure>(() =>
    Promise.resolve(handle(deps, input)).then((result) =>
      result.match(
        (value) => value,
        (error) => {
          throw error as ErrorValue | Failure;
        },
      ),
    ),
  );
