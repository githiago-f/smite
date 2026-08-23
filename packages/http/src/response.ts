import type { HttpResponse } from "./types.js";

/**
 * Builds a response with the given body and status (default 200).
 *
 * @group Responses
 * @example Build response bodies
 */
export const json = (body: unknown, status = 200): HttpResponse => ({
  status,
  body,
});

/**
 * A mutable, chainable status builder. `header` accumulates response headers;
 * `json` snapshots them into the final {@link HttpResponse}.
 *
 * @group Responses
 */
export interface StatusBuilder {
  /** Adds a response header (or overwrites it) to the response being built. */
  header: (name: string, value: string) => StatusBuilder;
  /** Builds the final response with the accumulated headers. */
  json: (body: unknown) => HttpResponse;
}

/**
 * Builds a response for a fixed status code, optionally accumulating headers
 * before calling `.json(body)`.
 *
 * @group Responses
 * @example Build response bodies
 */
export const status = (statusCode: number): StatusBuilder => {
  const headers: Record<string, string> = {};
  const builder: StatusBuilder = {
    header: (name: string, value: string) => {
      headers[name] = value;
      return builder;
    },
    json: (body: unknown): HttpResponse => ({
      status: statusCode,
      body,
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    }),
  };
  return builder;
};
