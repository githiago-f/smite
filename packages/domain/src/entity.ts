import { defineDescriptor } from "@smitejs/core";
import type { Descriptor } from "@smitejs/core";
import { Result } from "@smitejs/fp";
import type { z } from "zod";
import type { DomainValidationError } from "./value-object.js";
import { deepEqual, freezeDeep } from "./value.js";

/**
 * A `domain.entity` IR node.
 *
 * @group Internals
 */
export interface EntityDescriptor<Shape>
  extends Descriptor<
    "domain.entity",
    {
      readonly name: string;
      readonly idKey: string;
      readonly schema: z.ZodType<Shape>;
    }
  > {}

/**
 * A frozen domain value with a stable identity, compared by `id`.
 *
 * @group Types
 */
export interface Entity<Shape> {
  readonly value: Readonly<Shape>;
  readonly id: Shape[keyof Shape];
  readonly equals: (other: Entity<Shape>) => boolean;
  readonly hash: () => string;
}

/**
 * Factory produced by {@link entity}.
 *
 * @group Types
 */
export interface EntityFactory<Shape> {
  readonly name: string;
  readonly idKey: keyof Shape & string;
  readonly create: (
    input: unknown,
  ) => Result<Entity<Shape>, DomainValidationError>;
  readonly parse: (input: unknown) => Entity<Shape>;
}

/**
 * Declares an entity from a zod schema plus an `id` key. New entities are
 * frozen and validated on creation; equality follows identity (two entities
 * with the same `id` are the same entity). In collect mode a `domain.entity`
 * node is registered.
 *
 * @group Builders
 * @example Entity identity
 */
export function entity<Shape>(config: {
  readonly name: string;
  readonly id: keyof Shape & string;
  readonly schema: z.ZodType<Shape>;
}): EntityFactory<Shape> {
  defineDescriptor("domain.entity", config.name, {
    name: config.name,
    idKey: config.id,
    schema: config.schema,
  });

  const snapshot = (parsed: Shape): Entity<Shape> => {
    const value = freezeDeep(parsed);
    const id = (parsed as Record<string, unknown>)[
      config.id
    ] as Shape[keyof Shape];
    return {
      value,
      id,
      equals: (other) => deepEqual(id, other.id),
      hash: () => hash(id),
    };
  };

  return {
    name: config.name,
    idKey: config.id,
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

const hash = (value: unknown): string =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? JSON.stringify(canonicalId(value))
    : String(value);

const canonicalId = (value: object): unknown =>
  Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, (value as Record<string, unknown>)[key]]),
  );
