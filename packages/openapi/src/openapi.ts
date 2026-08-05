import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { SmitePlugin } from "@smitejs/cli";
import type { AppDescriptor } from "@smitejs/core";
import { routesOf } from "@smitejs/http";
import type { CollectedEndpoint, CollectedRoute } from "@smitejs/http";

/**
 * A single {@link https://swagger.io/specification/#server-object | Server}
 * object emitted under the document's `servers` array.
 *
 * @group Generator
 */
export interface OpenApiServer {
  readonly url: string;
  readonly description?: string;
  readonly variables?: Readonly<Record<string, unknown>>;
}

/**
 * Options for the {@link openapi} CLI plugin.
 *
 * @group Generator
 */
export interface OpenApiOptions {
  readonly outfile: string;
  readonly title?: string;
  readonly version?: string;
  /** {@link https://swagger.io/specification/#server-object | Server} objects emitted at the document root. */
  readonly servers?: readonly OpenApiServer[];
  /** Array of {@link https://swagger.io/specification/#security-requirement-object | Security Requirement} objects emitted at the document root. */
  readonly security?: readonly unknown[];
  /** Security schemes emitted under `components.securitySchemes`. */
  readonly securitySchemes?: Readonly<Record<string, unknown>>;
  /** Array of {@link https://swagger.io/specification/#tag-object | Tag} objects emitted at the document root. */
  readonly tags?: readonly unknown[];
  /** {@link https://swagger.io/specification/#external-documentation-object | External Documentation} object emitted at the document root. */
  readonly externalDocs?: unknown;
  /** Extra top-level fields merged verbatim into the emitted document. */
  readonly additional?: Readonly<Record<string, unknown>>;
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
  route: CollectedRoute,
  endpoint: CollectedEndpoint,
): readonly Parameter[] => {
  const parameters = [
    ...bucketParameters(route.req?.query, "query", false),
    ...bucketParameters(route.req?.params, "path", true),
    ...bucketParameters(route.req?.headers, "header", false),
  ];
  return ensurePathParams(parameters, endpoint);
};

const buildOperation = (
  route: CollectedRoute,
  endpoint: CollectedEndpoint,
): Record<string, unknown> => {
  const operation: Record<string, unknown> = {
    responses: { "200": { description: "OK" } },
  };
  if (route.summary !== undefined) {
    operation.summary = route.summary;
  }
  if (route.description !== undefined) {
    operation.description = route.description;
  }
  if (route.name !== undefined) {
    operation.tags = [route.name];
  }
  const parameters = buildParameters(route, endpoint);
  if (parameters.length > 0) {
    operation.parameters = parameters;
  }
  if (route.req?.body !== undefined) {
    operation.requestBody = {
      content: {
        "application/json": { schema: toJsonSchema(route.req.body) },
      },
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
          [endpoint.method.toLowerCase()]: buildOperation(route, endpoint),
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
    ...(options.servers === undefined ? {} : { servers: options.servers }),
    ...(options.security === undefined ? {} : { security: options.security }),
    ...(options.securitySchemes === undefined
      ? {}
      : { components: { securitySchemes: options.securitySchemes } }),
    ...(options.tags === undefined ? {} : { tags: options.tags }),
    ...(options.externalDocs === undefined
      ? {}
      : { externalDocs: options.externalDocs }),
    ...(options.additional ?? {}),
    paths,
  };
};

/**
 * CLI plugin factory for `@smitejs/cli`: an `openapi` plugin whose `run` emits an
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
