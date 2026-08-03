import { fillPath } from "./path-params.js";

/**
 * Global runtime defaults (`baseUrl`, `fetch`) set via `configure()`.
 *
 * @group Runtime
 */
export interface ClientConfig {
  readonly baseUrl?: string;
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * The bucketed input shape accepted by generated calls and `request()`.
 *
 * @group Runtime
 * @example Make a typed request
 */
export interface ClientInput {
  readonly params?: Readonly<Record<string, unknown>>;
  readonly query?: Readonly<Record<string, unknown>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly $config?: ClientConfig;
  // TODO: cookies/session buckets (roadmap) — the input is generic over
  // buckets, so adding them means touching @smite/http + serve as well.
}

/**
 * The shape returned by every generated call: mirrors the server response.
 *
 * @group Runtime
 */
export interface ClientResponse {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
}

let config: ClientConfig = {};

/**
 * Sets module-level defaults (`baseUrl`, `fetch`) for the runtime.
 *
 * @group Runtime
 * @example Configure the client runtime
 */
export function configure(next: ClientConfig): void {
  config = { ...config, ...next };
}

/**
 * Performs an HTTP request: interpolates path params, serializes query/body,
 * and returns `{ status, body, headers }`. Never throws on non-2xx.
 *
 * @group Runtime
 * @example Make a typed request
 */
export async function request(
  method: string,
  path: string,
  input?: ClientInput,
): Promise<ClientResponse> {
  const cfg: ClientConfig = { ...config, ...(input?.$config ?? {}) };
  const fetchFn = cfg.fetch ?? globalThis.fetch;
  if (fetchFn === undefined) {
    throw new Error(
      "No fetch implementation available. Call configure({ fetch }) first.",
    );
  }

  let url = input?.params === undefined ? path : fillPath(path, input.params);

  if (input?.query !== undefined) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(input.query)) {
      if (Array.isArray(value)) {
        for (const item of value) search.append(key, String(item));
      } else if (value !== undefined) {
        search.append(key, String(value));
      }
    }
    const queryString = search.toString();
    if (queryString !== "") url += `?${queryString}`;
  }

  const headers: Record<string, string> = { ...(input?.headers ?? {}) };
  let body: string | undefined;
  if (input?.body !== undefined) {
    if (typeof input.body === "string") {
      body = input.body;
    } else {
      body = JSON.stringify(input.body);
      if (headers["content-type"] === undefined) {
        headers["content-type"] = "application/json";
      }
    }
  }

  const response = await fetchFn((cfg.baseUrl ?? "") + url, {
    method,
    headers,
    ...(body === undefined ? {} : { body }),
  });

  const text = await response.text();
  let parsed: unknown = text;
  if (text !== "") {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return { status: response.status, body: parsed, headers: responseHeaders };
}
