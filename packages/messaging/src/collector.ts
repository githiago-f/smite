import { childrenOf } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import type { z } from "zod";
import type { ChannelKind, MessageConsumer } from "./channel.js";

/**
 * A channel as seen by artifact generators: its name, kind, and the payload
 * schema it validates against.
 *
 * @group Collector
 */
export interface CollectedChannel<Payload = unknown> {
  readonly name: string;
  readonly kind: ChannelKind;
  readonly schema?: z.ZodType<Payload>;
  readonly consumers: readonly MessageConsumer<Payload>[];
}

type ChannelNode = Descriptor<
  "messaging.channel",
  { name: string; kind: ChannelKind; schema?: z.ZodType }
>;

/**
 * Walks an app's `messaging.channel` children and returns the collected
 * channels with their consumers. Shared by artifact generators and the broker
 * executor.
 *
 * @group Collector
 * @example Collect an app's channels
 */
export function channelsOf(app: AppDescriptor): readonly CollectedChannel[] {
  return childrenOf(app, "messaging.channel").map((node) => {
    const channelNode = node as ChannelNode;
    return {
      name: channelNode.data.name,
      kind: channelNode.data.kind,
      ...(channelNode.data.schema === undefined
        ? {}
        : { schema: channelNode.data.schema }),
      consumers: childrenOf(node, "messaging.consumer").map(
        (consumer) =>
          (
            consumer as Descriptor<
              "messaging.consumer",
              { fn: MessageConsumer<unknown> }
            >
          ).data.fn,
      ),
    };
  });
}
