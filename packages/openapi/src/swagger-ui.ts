import { readFile } from "node:fs/promises";
import type { HttpRequest, HttpResponse, HttpRouter } from "@smitejs/http";

/**
 * Options for {@link swaggerUi}.
 *
 * @group Swagger UI
 */
export interface SwaggerUiOptions {
  /** The OpenAPI document to serve. */
  readonly doc: unknown;
  /** Page title shown in the browser tab. Defaults to "API Documentation". */
  readonly title?: string;
  /** Path that serves the Swagger UI page. Defaults to `/docs`. */
  readonly uiPath?: string;
  /** Path that serves the raw OpenAPI document. Defaults to `/openapi.json`. */
  readonly specPath?: string;
  /** Base URL for the Swagger UI assets. Defaults to the unpkg CDN. */
  readonly cdn?: string;
}

/**
 * Options for {@link swaggerUiFromFile}.
 *
 * @group Swagger UI
 */
export interface SwaggerUiFileOptions extends Omit<SwaggerUiOptions, "doc"> {
  /** Path to the OpenAPI JSON document to read and serve. */
  readonly file: string;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderPage = (
  title: string,
  specPath: string,
  cdn: string,
): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="${cdn}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${cdn}/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: ${JSON.stringify(specPath)},
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
        });
      };
    </script>
  </body>
</html>
`;

const json = (status: number, body: unknown): HttpResponse => ({
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
  body,
});

/**
 * Builds an {@link HttpRouter} that serves the OpenAPI document and a Swagger
 * UI page: `specPath` returns the doc as JSON and `uiPath` returns the HTML
 * page. Compose it alongside an app's `serve()` router in your dev server.
 *
 * @group Swagger UI
 * @example Serve the OpenAPI document
 */
export function swaggerUi(options: SwaggerUiOptions): HttpRouter {
  const title = options.title ?? "API Documentation";
  const uiPath = options.uiPath ?? "/docs";
  const specPath = options.specPath ?? "/openapi.json";
  const cdn = options.cdn ?? "https://unpkg.com/swagger-ui-dist@5";
  const page = renderPage(title, specPath, cdn);

  return async (request: HttpRequest): Promise<HttpResponse> => {
    if (request.path === specPath) {
      return json(200, options.doc);
    }
    if (request.path === uiPath) {
      return {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
        body: page,
      };
    }
    return json(404, { error: "Not Found" });
  };
}

/**
 * Builds an {@link HttpRouter} that reads the OpenAPI document from `file` and
 * serves it alongside a Swagger UI page: `specPath` returns the doc as JSON and
 * `uiPath` returns the HTML page. The file is re-read on each request so a
 * regenerated document is reflected without restarting the server. Returns
 * `404` when the file is missing or unparseable.
 *
 * @group Swagger UI
 * @example Serve the OpenAPI document from a file
 */
export function swaggerUiFromFile(options: SwaggerUiFileOptions): HttpRouter {
  const { file, ...ui } = options;
  return async (request: HttpRequest): Promise<HttpResponse> => {
    let doc: unknown;
    try {
      doc = JSON.parse(await readFile(file, "utf8")) as unknown;
    } catch {
      return json(404, { error: "Not Found" });
    }
    return swaggerUi({ ...ui, doc })(request);
  };
}
