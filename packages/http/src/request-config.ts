import type { z } from "zod";
import type { RouteInputConfig } from "./types.js";

const BUCKETS = ["query", "params", "headers", "body"] as const;

/**
 * Resolves the effective request config for an endpoint by per-bucket
 * inheritance: the endpoint's `req` wins when it declares a bucket, otherwise
 * the router-level `req` provides it. Returns `undefined` when neither
 * declares anything.
 *
 * @group Executor
 */
export const mergeRequestConfig = (
  base: RouteInputConfig | undefined,
  override: RouteInputConfig | undefined,
): RouteInputConfig | undefined => {
  if (base === undefined && override === undefined) {
    return undefined;
  }
  const merged: Partial<Record<(typeof BUCKETS)[number], z.ZodType>> = {};
  for (const bucket of BUCKETS) {
    const schema = override?.[bucket] ?? base?.[bucket];
    if (schema !== undefined) {
      merged[bucket] = schema;
    }
  }
  return merged as RouteInputConfig;
};
