import type { Descriptor } from "./descriptor.js";
import { defineDescriptor } from "./descriptor.js";

/**
 * Descriptor node that roots a Smite application graph.
 *
 * @group Junction
 */
export interface AppDescriptor extends Descriptor<"app", { name?: string }> {}

/**
 * Roots a new descriptor graph.
 *
 * @group Junction
 * @example Create an app junction
 */
export function createApp(name?: string): AppDescriptor {
  return defineDescriptor("app", name ?? "app", {
    ...(name !== undefined ? { name } : {}),
  });
}
