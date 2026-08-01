import type {
  HttpControllerBuilder,
  HttpControllerDescriptor,
} from "@smite/core";

/**
 * Any controller accepted by a specification projection.
 *
 * @group Specifications
 * @intent Accepts both raw descriptors and immutable builders when projecting an application.
 */
export type ControllerSource = HttpControllerBuilder | HttpControllerDescriptor;

/**
 * Normalizes controller sources into raw descriptors.
 *
 * @group Specifications
 * @intent Gives every projection one immutable descriptor model to consume.
 */
export const resolveControllers = (
  sources: readonly ControllerSource[],
): readonly HttpControllerDescriptor[] =>
  sources.map((source) =>
    "descriptor" in source ? source.descriptor : source,
  );
