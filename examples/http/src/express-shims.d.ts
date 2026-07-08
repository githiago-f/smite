declare module "express" {
  import type {
    ExpressNextFunction,
    ExpressRequestLike,
    ExpressResponseLike,
  } from "@smitejs/runtime-express";

  type RequestHandler = (
    request: ExpressRequestLike,
    response: ExpressResponseLike,
    next: ExpressNextFunction,
  ) => void | Promise<void>;

  interface ExpressApp {
    use(handler: RequestHandler): ExpressApp;
    listen(port: number, host: string, callback?: () => void): void;
  }

  interface ExpressFactory {
    (): ExpressApp;
    json(): RequestHandler;
  }

  const express: ExpressFactory;

  export default express;
}
