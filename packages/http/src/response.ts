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
 * Builds a response for a fixed status code.
 *
 * @group Responses
 * @example Build response bodies
 */
export const status = (status: number) => ({
  json: (body: unknown): HttpResponse => ({ status, body }),
});
