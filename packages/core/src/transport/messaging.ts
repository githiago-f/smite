import { freeze } from "../internal/freeze.js";
import {
  emptyLifecycleDescriptor,
  mergeLifecycleDescriptors,
} from "../lifecycle/merge.js";
import type {
  HandlerReference,
  LifecycleSource,
  MessagingConsumerDescriptor,
} from "../types.js";

/**
 * Immutable builder for a messaging consumer descriptor.
 *
 * @group Messaging
 * @intent Captures queue binding, handler reference and reusable lifecycle policy.
 * @example Messaging consumer with lifecycle
 */
export interface MessagingConsumerBuilder {
  readonly descriptor: MessagingConsumerDescriptor;
  readonly use: (...sources: readonly LifecycleSource[]) => MessagingConsumerBuilder;
  readonly queue: (queue: string) => MessagingConsumerBuilder;
  readonly handler: (handler: HandlerReference) => MessagingConsumerBuilder;
}

const createConsumerBuilder = (
  descriptor: MessagingConsumerDescriptor,
): MessagingConsumerBuilder =>
  freeze({
    descriptor,
    use: (...sources) =>
      createConsumerBuilder({
        ...descriptor,
        lifecycle: mergeLifecycleDescriptors(descriptor.lifecycle, ...sources),
      }),
    queue: (queue) =>
      createConsumerBuilder({
        ...descriptor,
        queue,
      }),
    handler: (handler) =>
      createConsumerBuilder({
        ...descriptor,
        handler,
      }),
  });

/**
 * Namespace for messaging transport builders.
 *
 * Messaging builders describe queue consumers as semantic metadata. They do
 * not connect brokers, poll queues or execute runtime pipelines.
 *
 * @group Messaging
 * @intent Public namespace for declaring messaging consumers as compile-time descriptors.
 * @example Messaging consumer with lifecycle
 */
export const messaging = freeze({
  consumer: (): MessagingConsumerBuilder =>
    createConsumerBuilder(
      freeze({
        kind: "messaging.consumer",
        queue: "",
        lifecycle: emptyLifecycleDescriptor(),
      }),
    ),
});
