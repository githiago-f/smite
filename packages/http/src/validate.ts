import type { z } from "zod";
import type { RouteInputConfig } from "./types.js";

type Bucket = "query" | "params" | "headers" | "body";

const parse = (schema: z.ZodType | undefined, value: unknown) => {
  if (schema === undefined) return { ok: true as const, data: value };
  const result = schema.safeParse(value);
  return result.success
    ? { ok: true as const, data: result.data }
    : { ok: false as const, error: result.error.issues };
};

export function validate(
  config: RouteInputConfig | undefined,
  input: Record<Bucket, unknown>,
) {
  const data = {} as Record<Bucket, unknown>;
  for (const bucket of Object.keys(input) as Bucket[]) {
    const parsed = parse(config?.[bucket], input[bucket]);
    if (!parsed.ok) return { error: parsed.error };
    data[bucket] = parsed.data;
  }
  return { data };
}
