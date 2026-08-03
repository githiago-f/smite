/**
 * Compile-time flag, replaced by bundlers:
 *   - collect mode  (CLI/compiler):  define ALLOW_GLOBAL_REGISTRY="true"
 *   - runtime mode  (user's esbuild):define ALLOW_GLOBAL_REGISTRY="false"
 *
 * Uses `typeof ... === "boolean" && ...` (instead of a bare reference) so an
 * undefined identifier never throws, and so esbuild `define` substitutes the
 * literal and folds the whole expression before tree-shaking.
 */
declare const ALLOW_GLOBAL_REGISTRY: boolean;

export const allowGlobalRegistry: boolean =
  typeof ALLOW_GLOBAL_REGISTRY === "boolean" && ALLOW_GLOBAL_REGISTRY;
