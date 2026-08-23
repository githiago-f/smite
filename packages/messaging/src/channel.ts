import { defineDescriptor, refine, relate } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import type { z } from "zod";

/**
 * A named inbound/outbound messaging endpoint. `queue` delivers each message
 * to one consumer; `topic` broadcasts to every consumer on the channel.
 *
 * @group Types
 */
export type ChannelKind = "queue" | "topic";

/**
 * The envelope a consumer receives.
 *
 * @group Types
 */
export interface MessageEnvelope<Payload> {
  readonly id: string;
  readonly channel: string;
  readonly publishedAt: number;
  readonly payload: Payload;
}

/**
 * A consumer for a channel: receives each delivered {@link MessageEnvelope}.
 *
 * @group Types
 */
export type MessageConsumer<Payload> = (
  envelope: MessageEnvelope<Payload>,
) => void | Promise<void>;

/**
 * A `messaging.channel` IR node.
 *
 * @group Internals
 */
export interface MessagingChannelDescriptor<Payload>
  extends Descriptor<
    "messaging.channel",
    {
      readonly name: string;
      readonly kind: ChannelKind;
      readonly schema?: z.ZodType<Payload>;
    }
  > {}

/**
 * A node wrapping a channel's consumer function.
 *
 * @group Internals
 */
export interface MessagingConsumerDescriptor<Payload>
  extends Descriptor<
    "messaging.consumer",
    { readonly fn: MessageConsumer<Payload> }
  > {}

/**
 * A channel builder: pick a `kind` and optional zod `schema` from one shared
 * `channel(app, name)` piece, then attach consumers with `on(fn)`. Always a
 * builder; each `on()` relates a `messaging.consumer` child under the channel.
 *
 * @group Builders
 */
export interface MessagingChannelBuilder<Payload> {
  /** Sets the delivery semantics (`queue` or `topic`, default `topic`). */
  readonly kind: <NextKind extends ChannelKind>(
    kind: NextKind,
  ) => MessagingChannelBuilder<Payload>;
  /** Sets the zod schema each envelope payload is validated against. */
  readonly schema: <Next extends Payload>(
    schema: z.ZodType<Next>,
  ) => MessagingChannelBuilder<Next>;
  /** Registers a consumer; `queue` delivers to one, `topic` to every one. */
  readonly on: (
    fn: MessageConsumer<Payload>,
  ) => MessagingChannelBuilder<Payload>;
  /** The underlying `messaging.channel` IR node. */
  readonly node: MessagingChannelDescriptor<Payload>;
}

/**
 * Creates a channel builder for an app. The shared `(app, name)` piece yields a
 * builder that refines `kind`/`schema` and attaches any number of `messaging
 * .consumer` children, related under the app's `messaging.channel` node.
 *
 * @group Builders
 * @example Define a channel
 */
export function channel<Payload = unknown>(
  app: AppDescriptor,
  name: string,
): MessagingChannelBuilder<Payload> {
  const descriptor = defineDescriptor(
    "messaging.channel",
    `${app.__key}:channel:${name}`,
    { name, kind: "topic" },
  ) as MessagingChannelDescriptor<Payload>;
  relate(app, "messaging.channel", descriptor);

  let consumerCount = 0;

  const builder: MessagingChannelBuilder<Payload> = {
    node: descriptor,
    kind: <NextKind extends ChannelKind>(kind: NextKind) => {
      refine(descriptor, { kind });
      return builder;
    },
    schema: <Next extends Payload>(schema: z.ZodType<Next>) => {
      refine(descriptor, { schema });
      return builder as unknown as MessagingChannelBuilder<Next>;
    },
    on: (fn: MessageConsumer<Payload>) => {
      const consumer = defineDescriptor(
        "messaging.consumer",
        `${descriptor.__key}:consumer:${consumerCount++}`,
        { fn },
      );
      relate(descriptor, "messaging.consumer", consumer);
      return builder;
    },
  };
  return builder;
}

/**
 * Fires a channel's consumers with a fresh envelope at the given (or current)
 * instant. `queue` routes to the most recent consumer; `topic` fans out to
 * every consumer. Returns the number of consumers invoked.
 *
 * @group Executor
 */
export const dispatchTo = <Payload = unknown>(
  descriptor: MessagingChannelDescriptor<Payload>,
  consumers: readonly MessagingConsumerDescriptor<Payload>[],
  payload: unknown,
  at: number | Date = Date.now(),
): Promise<number> => {
  const envelope: MessageEnvelope<Payload> = {
    id: `${descriptor.data.name}:${Date.now()}`,
    channel: descriptor.data.name,
    publishedAt: typeof at === "number" ? at : at.getTime(),
    payload: payload as Payload,
  };
  const targets =
    descriptor.data.kind === "queue" ? consumers.slice(-1) : consumers;
  return Promise.all(
    targets.map((consumer) => Promise.resolve(consumer.data.fn(envelope))),
  ).then(() => targets.length);
};
