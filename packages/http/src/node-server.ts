import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AppDescriptor } from "@smitejs/core";
import { serve } from "./serve.js";
import type { HttpRouter } from "./serve.js";
import type { HttpRequest, HttpResponse } from "./types.js";

/**
 * A router mounted at one or more exact paths, served ahead of the app's own
 * routes. Use it for documentation or admin endpoints that must not collide
 * with app routes.
 *
 * @group Node server
 */
export interface NodeServerDocs {
  /** The router to consult for `paths` (e.g. `swaggerUi({ doc, title })`). */
  readonly router: HttpRouter;
  /** The exact request paths the router handles. */
  readonly paths: readonly string[];
}

/**
 * Options for {@link serveNode}.
 *
 * @group Node server
 */
export interface NodeServerOptions {
  /** Routers mounted at fixed paths, checked before the app's router. */
  readonly docs?: NodeServerDocs;
  /**
   * Extensibility seam: adapts the parsed request before dispatch. Returned
   * fields override `parsed`.
   */
  readonly transformRequest?: (
    req: IncomingMessage,
    parsed: HttpRequest,
  ) => Partial<HttpRequest> | Promise<Partial<HttpRequest>>;
}

const parseCookies = (cookie: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (cookie === undefined) return cookies;
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key.length > 0) cookies[key] = value;
  }
  return cookies;
};

const parseRequest = async (req: IncomingMessage): Promise<HttpRequest> => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";

  let body: unknown;
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    if (raw.length > 0) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = undefined;
      }
    }
  }

  return {
    method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: req.headers,
    cookies: parseCookies(req.headers.cookie),
    params: {},
    body,
  };
};

const writeResponse = (res: ServerResponse, served: HttpResponse): void => {
  const contentType =
    served.headers?.["content-type"] ?? "application/json; charset=utf-8";
  const out =
    typeof served.body === "string"
      ? served.body
      : JSON.stringify(served.body ?? null);
  res.writeHead(served.status, {
    ...served.headers,
    "content-type": contentType,
  });
  res.end(out);
};

/**
 * Turns an app into a `node:http` server. Parses the request into an
 * {@link HttpRequest}, dispatches through `serve(app)` (with any mounted
 * `docs` routers checked first), and writes the response. The returned server
 * is not yet listening, so callers compose `.listen(port, host, onListen)`.
 *
 * @group Node server
 * @example Serve an app over node:http
 */
export function serveNode(
  app: AppDescriptor,
  options: NodeServerOptions = {},
): Server {
  const router = serve(app);
  const docs = options.docs;
  const transformRequest = options.transformRequest;

  return createServer(async (req, res) => {
    try {
      const parsed = await parseRequest(req);
      const request =
        transformRequest === undefined
          ? parsed
          : { ...parsed, ...(await transformRequest(req, parsed)) };

      const served =
        docs?.paths.includes(request.path) === true
          ? await docs.router(request)
          : await router(request);

      writeResponse(res, served);
    } catch {
      res.writeHead(500, {
        "content-type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  });
}
