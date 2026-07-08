export { http } from "./transport/http.js";
export { messaging } from "./transport/messaging.js";
export { scheduler } from "./transport/scheduler.js";
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
export type { MessagingConsumerBuilder } from "./transport/messaging.js";
export type { SchedulerJobBuilder } from "./transport/scheduler.js";
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
  MessagingConsumerDescriptor,
  SchedulerJobDescriptor,
} from "./types.js";
