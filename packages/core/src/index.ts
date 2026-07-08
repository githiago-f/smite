export { http } from "./transport/http.js";
export { lifecycle } from "./lifecycle/lifecycle.js";
export { mergeLifecycleDescriptors } from "./lifecycle/merge.js";

export type {
  LifecycleBuilder,
  LifecycleEntryDefinition,
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
  LifecycleEntryImplementation,
  LifecycleEntryKind,
  LifecycleEntryOptions,
  LifecycleSource,
} from "./types.js";
