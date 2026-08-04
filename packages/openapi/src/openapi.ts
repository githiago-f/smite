import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { SmitePlugin } from "@smite/cli";
import type { AppDescriptor } from "@smite/core";
import { routesOf } from "@smite/http";
import type { CollectedEndpoint, RouteInputConfig } from "@smite/http";

/**
 * Options for the {@link openapi} CLI plugin.
 *
 * @group Generator
 */
export interface OpenApiOptions {
  readonly outfile: string;
  readonly title?: string;
  readonly version?: string;
}

type JsonSchemaLike = { readonly toJSONSchema?: () => unknown };

const toJsonSchema = (schema: unknown): unknown => {
  if (schema === undefined || schema === null) return {};
  return (schema as JsonSchemaLike).toJSONSchema?.() ?? {};
};

const toOasPath = (path: string): string =>
  path.replace(/\/:([A-Za-z0-9_]+)/g, "/{$1}");

type ParameterIn = "query" | "path" | "header";

interface Parameter {
  readonly name: string;
  readonly in: ParameterIn;
  readonly required: boolean;
  readonly schema: unknown;
}

const bucketParameters = (
  schema: unknown,
  location: ParameterIn,
  forceRequired: boolean,
): readonly Parameter[] => {
  const json = toJsonSchema(schema) as {
    readonly type?: string;
    readonly properties?: Record<string, unknown>;
    readonly required?: readonly string[];
  };
  if (json.type !== "object" || json.properties === undefined) return [];
  return Object.entries(json.properties).map(([name, propertySchema]) => ({
    name,
    in: location,
    required: forceRequired || (json.required?.includes(name) ?? false),
    schema: propertySchema,
  }));
};

const ensurePathParams = (
  parameters: readonly Parameter[],
  endpoint: CollectedEndpoint,
): readonly Parameter[] => {
  const declared = new Set(
    parameters
      .filter((parameter) => parameter.in === "path")
      .map((p) => p.name),
  );
  const missing = endpoint.pathParams
    .filter((param) => !declared.has(param))
    .map(
      (param): Parameter => ({
        name: param,
        in: "path",
        required: true,
        schema: { type: "string" },
      }),
    );
  return [...parameters, ...missing];
};

const buildParameters = (
  req: RouteInputConfig | undefined,
  endpoint: CollectedEndpoint,
): readonly Parameter[] => {
  const parameters = [
    ...bucketParameters(req?.query, "query", false),
    ...bucketParameters(req?.params, "path", true),
    ...bucketParameters(req?.headers, "header", false),
  ];
  return ensurePathParams(parameters, endpoint);
};

const buildOperation = (
  req: RouteInputConfig | undefined,
  endpoint: CollectedEndpoint,
): Record<string, unknown> => {
  const operation: Record<string, unknown> = {
    responses: { "200": { description: "OK" } },
  };
  const parameters = buildParameters(req, endpoint);
  if (parameters.length > 0) {
    operation.parameters = parameters;
  }
  if (req?.body !== undefined) {
    operation.requestBody = {
      content: { "application/json": { schema: toJsonSchema(req.body) } },
    };
  }
  return operation;
};

const buildDocument = (
  apps: readonly AppDescriptor[],
  options: OpenApiOptions,
): unknown => {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const app of apps) {
    for (const route of routesOf(app)) {
      for (const endpoint of route.endpoints) {
        if (endpoint.method === "ANY") {
          console.warn(`Skipping ANY endpoint '${endpoint.path}'.`);
          continue;
        }
        const oasPath = toOasPath(endpoint.path);
        paths[oasPath] = {
          ...(paths[oasPath] ?? {}),
          [endpoint.method.toLowerCase()]: buildOperation(route.req, endpoint),
        };
      }
    }
  }
  return {
    openapi: "3.1.0",
    info: {
      title: options.title ?? "Smite API",
      version: options.version ?? "0.1.0",
    },
    paths,
  };
};

/**
 * CLI plugin factory for `@smite/cli`: an `openapi` plugin whose `run` emits an
 * OpenAPI 3.1 document for the compiled app's routes, converting each `req`
 * bucket's zod schema to JSON Schema via `.toJSONSchema()` on the user's live
 * schema instances.
 *
 * @group Generator
 * @example Generate an OpenAPI document
 */
export function openapi(options: OpenApiOptions): SmitePlugin {
  return {
    name: "openapi",
    async run({ apps }) {
      const document = buildDocument(apps, options);
      const outfile = resolve(process.cwd(), options.outfile);
      await mkdir(dirname(outfile), { recursive: true });
      await writeFile(outfile, JSON.stringify(document, null, 2), "utf8");
    },
  };
}
