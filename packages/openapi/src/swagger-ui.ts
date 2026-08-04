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
