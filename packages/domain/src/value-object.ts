import { defineDescriptor } from "@smitejs/core";
import type { Descriptor } from "@smitejs/core";
import { Result } from "@smitejs/fp";
import type { z } from "zod";
import { deepEqual, freezeDeep, hashOf } from "./value.js";

/**
 * The failure carried by a failed `create`/`parse`: the zod validation issues.
 *
 * @group Types
 */
export type DomainValidationError = {
  readonly tag: "domain.validation";
  readonly data: readonly z.ZodIssue[];
};

/**
 * A `domain.valueObject` IR node.
 *
 * @group Internals
 */
export interface ValueObjectDescriptor<Shape>
  extends Descriptor<
    "domain.valueObject",
    { readonly name: string; readonly schema: z.ZodType<Shape> }
  > {}

/**
 * A frozen, structurally-equal domain value.
 *
 * @group Types
 */
export interface ValueObject<Shape> {
  readonly value: Readonly<Shape>;
  readonly equals: (other: ValueObject<Shape>) => boolean;
  readonly hash: () => string;
}

/**
 * Factory produced by {@link valueObject}.
 *
 * @group Types
 */
export interface ValueObjectFactory<Shape> {
  readonly name: string;
  readonly schema: z.ZodType<Shape>;
  readonly create: (
    input: unknown,
  ) => Result<ValueObject<Shape>, DomainValidationError>;
  readonly parse: (input: unknown) => ValueObject<Shape>;
}

/**
 * Creates a value object factory from a zod schema. Values are frozen on
 * creation and equal structurally (by parsed value, never by reference). In
 * collect mode a `domain.valueObject` node is registered.
 *
 * @group Builders
 * @example Create value objects
 */
export function valueObject<Shape>(config: {
  readonly name: string;
  readonly schema: z.ZodType<Shape>;
}): ValueObjectFactory<Shape> {
  defineDescriptor("domain.valueObject", config.name, {
    name: config.name,
    schema: config.schema,
  });

  const snapshot = (parsed: Shape): ValueObject<Shape> => {
    const value = freezeDeep(parsed);
    return {
      value,
      equals: (other) => deepEqual(value, other.value),
      hash: () => hashOf(value),
    };
  };

  return {
    name: config.name,
    schema: config.schema,
    create: (input: unknown) => {
      const parsed = config.schema.safeParse(input);
      return parsed.success
        ? Result.ok(snapshot(parsed.data))
        : Result.err("domain.validation", parsed.error.issues);
    },
    parse: (input: unknown) => {
      const parsed = config.schema.safeParse(input);
      if (!parsed.success) {
        throw new Error(
          `Invalid ${config.name}: ${parsed.error.issues[0]?.message ?? "invalid value"}.`,
        );
      }
      return snapshot(parsed.data);
    },
  };
}
