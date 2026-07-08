export { http } from "./transport/http.js";
export { lifecycle } from "./lifecycle/lifecycle.js";
export { mergeLifecycleDescriptors } from "./lifecycle/merge.js";

export type {
  LifecycleBuilder,
  LifecycleEntryBuilder,
} from "./lifecycle/lifecycle.js";
export type {
  HttpControllerBuilder,
  HttpRouteBuilder,
} from "./transport/http.js";
export type {
  Descriptor,
  DescriptorBuilder,
  HandlerReference,
  HttpControllerDescriptor,
  HttpMethod,
  HttpRouteDescriptor,
  LifecycleCompositionDescriptor,
  LifecycleEntry,
  LifecycleEntryKind,
  LifecycleEntryOptions,
  LifecycleSource,
} from "./types.js";
