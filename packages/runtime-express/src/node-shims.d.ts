declare module "node:http" {
  import type {
    NodeHttpRequest,
    NodeHttpResponse,
    NodeHttpServer,
  } from "./types.js";

  export function createServer(
    handler: (
      request: NodeHttpRequest,
      response: NodeHttpResponse,
    ) => void | Promise<void>,
  ): NodeHttpServer;
}
