import type {
  DescriptorBuilder,
  HttpControllerDescriptor,
  HttpExecutionContext,
  HttpExecutionRequest,
  HttpExecutionResult,
  HttpHandlerResult,
  HttpRouteDescriptor,
  HttpRuntimeFunction,
  LifecycleCompositionDescriptor,
  LifecycleEntry,
  LifecycleEntryKind,
} from "@smitejs/core";

export type ExpressNextFunction = (error?: unknown) => void;

export interface ExpressRequestLike {
  readonly method?: string;
  readonly url?: string;
  readonly path?: string;
  readonly originalUrl?: string;
  readonly headers?: Readonly<
    Record<string, string | readonly string[] | undefined>
  >;
  readonly body?: unknown;
  readonly query?: Readonly<Record<string, unknown>>;
  readonly params?: Readonly<Record<string, string>>;
}

export interface ExpressResponseLike {
  headersSent?: boolean;
  statusCode?: number;
  status?(status: number): ExpressResponseLike;
  json?(body: unknown): void;
  send?(body: unknown): void;
  end?(body?: string): void;
  setHeader?(name: string, value: string): void;
}

export type SmiteHttpRequest = HttpExecutionRequest;

export type SmiteHttpContext = HttpExecutionContext;

export type SmiteHttpResult = HttpExecutionResult;

export type SmiteHttpHandlerResult = HttpHandlerResult;

export type SmiteHttpRuntimeFunction = HttpRuntimeFunction;

export type ExpressControllerSource =
  | ExpressControllerDescriptor
  | DescriptorBuilder<ExpressControllerDescriptor>;

export interface ExpressRuntimeOptions {
  readonly controllers: readonly ExpressControllerSource[];
}

export interface NodeHttpRequest extends AsyncIterable<Uint8Array> {
  readonly method?: string;
  readonly url?: string;
  readonly headers: Readonly<
    Record<string, string | readonly string[] | undefined>
  >;
}

export interface NodeHttpResponse {
  readonly headersSent: boolean;
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

export interface NodeHttpServer {
  listen(port: number, callback?: () => void): void;
  listen(port: number, host: string, callback?: () => void): void;
  close(callback?: () => void): void;
}

export type ExpressLifecycleEntryKind = LifecycleEntryKind;

export type ExpressLifecycleEntry = LifecycleEntry;

export type ExpressLifecycleComposition = LifecycleCompositionDescriptor;

export type ExpressControllerDescriptor = HttpControllerDescriptor;

export type ExpressRouteDescriptor = HttpRouteDescriptor;
