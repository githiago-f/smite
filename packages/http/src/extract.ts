import { Option, extractorMetadata } from "@smite/fp";
import type { Extractor, ExtractorMetadata, ExtractorSource } from "@smite/fp";
import type { HttpRequest } from "./types.js";

type ExtractSource = Exclude<ExtractorSource, "chain" | "custom">;

const withMetadata = <Value>(
  source: ExtractSource,
  key: string,
  read: (request: HttpRequest) => Option<Value>,
): Extractor<HttpRequest, Value> => {
  const extractor = ((request: HttpRequest) => read(request)) as Extractor<
    HttpRequest,
    Value
  >;
  const metadata: ExtractorMetadata = Object.freeze({
    kind: "fp.extractor",
    source,
    key,
  });

  Object.defineProperty(extractor, extractorMetadata, {
    configurable: false,
    enumerable: false,
    value: metadata,
  });

  return extractor;
};

/**
 * Reads a cookie value from the request, returning `none` when absent.
 *
 * @group Extraction
 * @example Chain extractors over a request
 */
export const cookies = (name: string): Extractor<HttpRequest, string> =>
  withMetadata("cookie", name, (request) =>
    Option.fromNullable(request.cookies[name]),
  );

/**
 * Reads a header value from the request, returning `none` when absent.
 *
 * @group Extraction
 * @example Chain extractors over a request
 */
export const headers = (name: string): Extractor<HttpRequest, string> =>
  withMetadata("header", name, (request) => {
    const value = request.headers[name];
    const single: string | undefined =
      typeof value === "string"
        ? value
        : Array.isArray(value)
          ? (value[0] as string | undefined)
          : undefined;
    return Option.fromNullable(single);
  });

/**
 * Reads a path parameter from the request, returning `none` when absent.
 *
 * @group Extraction
 * @example Chain extractors over a request
 */
export const params = (name: string): Extractor<HttpRequest, string> =>
  withMetadata("param", name, (request) =>
    Option.fromNullable(request.params[name]),
  );

/**
 * Reads a query parameter from the request, returning `none` when absent.
 *
 * @group Extraction
 * @example Chain extractors over a request
 */
export const query = (name: string): Extractor<HttpRequest, string> =>
  withMetadata("query", name, (request) => {
    const value = request.query[name];
    return Option.fromNullable(typeof value === "string" ? value : undefined);
  });
