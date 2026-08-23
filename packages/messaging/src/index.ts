export { channel, dispatchTo } from "./channel.js";
export type {
  ChannelKind,
  MessageConsumer,
  MessageEnvelope,
  MessagingChannelBuilder,
  MessagingChannelDescriptor,
  MessagingConsumerDescriptor,
} from "./channel.js";

export { broker } from "./broker.js";
export type { MessageBroker } from "./broker.js";

export { channelsOf } from "./collector.js";
export type { CollectedChannel } from "./collector.js";

import { broker } from "./broker.js";
import { channel } from "./channel.js";
import { channelsOf } from "./collector.js";

/**
 * The messaging namespace: one import for the whole messaging app extensor —
 * channel builders, the broker executor, and the collector.
 *
 * @group Surface
 * @example Declare a messaging bundle
 */
export const messaging = {
  broker,
  channel,
  channelsOf,
};
