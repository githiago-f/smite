import { executeHttpPipeline } from "@smite/core";
import {
  type Router as ExpressRouter,
  type RequestHandler,
  Router,
} from "express";
import type {
  ExpressControllerDescriptor,
  ExpressRequestLike,
  ExpressResponseLike,
  ExpressRouteDescriptor,
  ExpressRuntimeOptions,
} from "./types.js";

const routeMethods = {
  GET: "get",
  POST: "post",
  PUT: "put",
  PATCH: "patch",
  DELETE: "delete",
  HEAD: "head",
  OPTIONS: "options",
} as const;

export const createExpressRuntime = (
  options: ExpressRuntimeOptions,
): ExpressRouter => {
  const router = Router();

  for (const controller of options.controllers.map(unwrapController)) {
    const controllerRouter = Router();

    for (const route of controller.routes) {
      controllerRouter[routeMethods[route.method]](
        route.path,
        createRouteMiddleware(controller, route),
      );
    }

    router.use(controller.path, controllerRouter);
  }

  return router;
};

const createRouteMiddleware =
  (
    controller: ExpressControllerDescriptor,
    route: ExpressRouteDescriptor,
  ): RequestHandler =>
  async (request, response, next) => {
    try {
      const result = await executeHttpPipeline(
        controller,
        route,
        createHttpExecutionContext(request as unknown as ExpressRequestLike),
      );
      sendExpressResult(response as unknown as ExpressResponseLike, result);
    } catch (error) {
      next(error);
    }
  };

const unwrapController = (
  source: ExpressRuntimeOptions["controllers"][number],
): ExpressControllerDescriptor => {
  if ("descriptor" in source) {
    return source.descriptor;
  }

  return source;
};

const createHttpExecutionContext = (
  request: ExpressRequestLike,
): Parameters<typeof executeHttpPipeline>[2] => {
  const url = new URL(
    request.originalUrl ?? request.url ?? "/",
    "http://smite.local",
  );

  return {
    request: {
      method: request.method?.toUpperCase() ?? "GET",
      path: normalizePath(request.path ?? url.pathname),
      headers: request.headers ?? {},
      cookies:
        request.cookies ?? parseCookies(readCookieHeader(request.headers)),
      query: request.query ?? Object.fromEntries(url.searchParams.entries()),
      params: request.params ?? {},
      body: request.body,
      raw: request,
    },
    state: {},
  };
};

const readCookieHeader = (
  headers: ExpressRequestLike["headers"],
): string | undefined => {
  if (!headers) {
    return undefined;
  }

  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== "cookie") {
      continue;
    }

    if (typeof value === "string") {
      return value;
    }

    return Array.isArray(value) ? value[0] : undefined;
  }

  return undefined;
};

const parseCookies = (header: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};

  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    if (name.length === 0) {
      continue;
    }

    cookies[name] = decodeCookieValue(part.slice(separator + 1).trim());
  }

  return cookies;
};

const decodeCookieValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const sendExpressResult = (
  response: ExpressResponseLike,
  result: Awaited<ReturnType<typeof executeHttpPipeline>>,
): void => {
  if (response.headersSent) {
    return;
  }

  for (const [name, value] of Object.entries(result.headers ?? {})) {
    response.setHeader?.(name, value);
  }

  const status = result.status ?? (result.body === undefined ? 204 : 200);

  if (response.status) {
    response.status(status);
  } else {
    response.statusCode = status;
  }

  if (result.body === undefined) {
    response.end?.();
    return;
  }

  if (response.json) {
    response.json(result.body);
    return;
  }

  response.setHeader?.("content-type", "application/json");
  response.end?.(JSON.stringify(result.body));
};

const normalizePath = (path: string): string => {
  if (path === "") {
    return "/";
  }

  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
};
