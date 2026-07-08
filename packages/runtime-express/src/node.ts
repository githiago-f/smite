import { createServer } from "node:http";
import { createExpressRuntime } from "./runtime.js";
import type {
  ExpressRuntimeOptions,
  NodeHttpRequest,
  NodeHttpResponse,
  NodeHttpServer,
} from "./types.js";

export const createNodeHttpServer = (
  options: ExpressRuntimeOptions,
): NodeHttpServer => {
  const runtime = createExpressRuntime(options);

  return createServer(async (request, response) => {
    try {
      const body = await readJsonBody(request);
      await runtime(
        {
          method: request.method,
          url: request.url,
          headers: request.headers,
          body,
        },
        createNodeResponseAdapter(response),
        (error) => {
          if (error) {
            sendNodeJson(response, 500, { error: "Internal server error" });
          }
        },
      );
    } catch {
      sendNodeJson(response, 400, { error: "Invalid request" });
    }
  });
};

const createNodeResponseAdapter = (
  response: NodeHttpResponse,
): {
  readonly headersSent: boolean;
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
} => ({
  get headersSent() {
    return response.headersSent;
  },
  get statusCode() {
    return response.statusCode;
  },
  set statusCode(status: number) {
    response.statusCode = status;
  },
  setHeader: (name, value) => response.setHeader(name, value),
  end: (body) => response.end(body),
});

const readJsonBody = async (
  request: AsyncIterable<Uint8Array>,
): Promise<unknown> => {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = decodeChunks(chunks);
  if (raw.trim().length === 0) {
    return undefined;
  }

  return JSON.parse(raw);
};

const sendNodeJson = (
  response: NodeHttpResponse,
  status: number,
  body: unknown,
): void => {
  if (response.headersSent) {
    return;
  }

  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
};

const decodeChunks = (chunks: readonly Uint8Array[]): string => {
  if (chunks.length === 0) {
    return "";
  }

  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const buffer = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(buffer);
};
