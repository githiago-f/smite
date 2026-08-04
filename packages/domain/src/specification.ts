import { defineDescriptor } from "@smitejs/core";
import type { Descriptor } from "@smitejs/core";
import { Result } from "@smitejs/fp";

/**
 * The default reason carried by a failed specification. Predicates build it
 * with `Result.err(tag, data)`.
 *
 * @group Types
 */
export type SpecificationReason = {
  readonly tag: string;
  readonly data?: unknown;
};

/**
 * A `domain.specification` IR node.
 *
 * @group Internals
 */
export interface SpecificationDescriptor
  extends Descriptor<
    "domain.specification",
    { readonly name: string; readonly operators: readonly string[] }
  > {}

/**
 * A rule that returns a `Result` instead of a bare boolean, so a failed check
 * carries *why*.
 *
 * @group Types
 */
export type SpecificationPredicate<Value, Reason> = (
  input: Value,
) => Result<boolean, Reason>;

/**
 * A named, composable business rule. `and`/`or`/`not` return new specifications
 * and never mutate the receiver (open/closed).
 *
 * @group Types
 */
export interface Specification<Value, Reason = SpecificationReason> {
  readonly name: string;
  readonly isSatisfiedBy: SpecificationPredicate<Value, Reason>;
  readonly and: (
    ...others: readonly Specification<Value, Reason>[]
  ) => Specification<Value, Reason>;
  readonly or: (
    ...others: readonly Specification<Value, Reason>[]
  ) => Specification<Value, Reason>;
  readonly not: () => Specification<Value, Reason>;
}

/**
 * Creates a named specification from a reason-returning predicate. The
 * predicate returns `Result.ok(true)` when satisfied or `Result.err(tag, data)`
 * otherwise. In collect mode a `domain.specification` node is registered.
 *
 * @group Builders
 * @example Compose specifications
 */
export function specification<Value, Reason = SpecificationReason>(config: {
  readonly name: string;
  readonly predicate: SpecificationPredicate<Value, Reason>;
}): Specification<Value, Reason> {
  defineDescriptor("domain.specification", config.name, {
    name: config.name,
    operators: [],
  });
  return withOperators({ name: config.name, isSatisfiedBy: config.predicate });
}

/**
 * Combines specifications so every one must pass. Short-circuits at the first
 * failure and returns that reason. An empty checklist always passes.
 *
 * @group Builders
 * @example Compose specifications
 */
export function mergeSpecifications<Value, Reason = SpecificationReason>(
  ...specs: readonly Specification<Value, Reason>[]
): Specification<Value, Reason> {
  const first = specs[0];
  if (first === undefined) {
    return withOperators({ name: "all", isSatisfiedBy: () => Result.ok(true) });
  }
  return first.and(...specs.slice(1));
}

type Core<Value, Reason> = {
  readonly name: string;
  readonly isSatisfiedBy: SpecificationPredicate<Value, Reason>;
};

const withOperators = <Value, Reason>(
  core: Core<Value, Reason>,
): Specification<Value, Reason> => {
  const operatorNames = (
    others: readonly Specification<Value, Reason>[],
    glue: string,
  ): string =>
    others.length === 0
      ? core.name
      : `${core.name} ${glue} ${others.map((other) => other.name).join(` ${glue} `)}`;

  return {
    name: core.name,
    isSatisfiedBy: core.isSatisfiedBy,
    and: (...others) =>
      withOperators({
        name: operatorNames(others, "&"),
        isSatisfiedBy: (input) => {
          for (const rule of [core, ...others]) {
            const result = rule.isSatisfiedBy(input);
            if (result.isErr()) return result;
          }
          return Result.ok(true);
        },
      }),
    or: (...others) =>
      withOperators({
        name: operatorNames(others, "|"),
        isSatisfiedBy: (input) => {
          let failure: Result<boolean, Reason> | undefined;
          for (const rule of [core, ...others]) {
            const result = rule.isSatisfiedBy(input);
            if (result.isOk()) return Result.ok(true);
            failure ??= result;
          }
          return (
            failure ??
            (Result.err({
              tag: "domain.unsatisfied",
              data: { spec: core.name },
            }) as Result<boolean, Reason>)
          );
        },
      }),
    not: () =>
      withOperators({
        name: `not ${core.name}`,
        isSatisfiedBy: (input) =>
          core.isSatisfiedBy(input).match(
            () =>
              Result.err<Reason, boolean>({
                tag: "domain.not-satisfied",
                data: { spec: core.name },
              } as unknown as Reason),
            () => Result.ok(true),
          ),
      }),
  };
};
