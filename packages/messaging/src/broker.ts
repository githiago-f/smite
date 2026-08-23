import { finalizeDescriptor } from "@smitejs/core";
import type { AppDescriptor } from "@smitejs/core";
import { channelsOf } from "./collector.js";
import type { CollectedChannel } from "./collector.js";

/**
 * A runtime handle returned by {@link broker}: the collected channels, plus
 * `publish` to deliver a payload and `lookup` to find a channel by name.
 *
 * @group Executor
 */
export interface MessageBroker {
  readonly channels: readonly CollectedChannel[];
  /** Delivers a payload to a channel's consumers; resolves the number sent. */
  readonly publish: (channel: string, payload: unknown) => Promise<number>;
  /** Finds a collected channel by name, if the app declares one. */
  readonly lookup: (channel: string) => CollectedChannel | undefined;
}

/**
 * A runtime in-memory broker that walks an app's `messaging.channel` IR tree
 * (via child refs, never the registry) and delivers published payloads to the
 * registered consumers. `queue` channels route to the most recent consumer;
 * `topic` channels fan out to every consumer. Works standalone and behind a
 * transport — same stateless per-trigger contract as every executor.
 *
 * @group Executor
 * @example Publish a message to a channel
 */
export function broker(app: AppDescriptor): MessageBroker {
  finalizeDescriptor(app);
  const channels = channelsOf(app);
  const byName = new Map(channels.map((channel) => [channel.name, channel]));

  return {
    channels,
    lookup: (channelName) => byName.get(channelName),
    publish: async (channelName, payload) => {
      const channel = byName.get(channelName);
      if (channel === undefined) return 0;
      return dispatchToChannel(channel, payload);
    },
  };
}

const dispatchToChannel = async (
  channel: CollectedChannel,
  payload: unknown,
): Promise<number> => {
  const parsed = safePayload(channel, payload);
  if (parsed.error !== undefined) throw parsed.error;

  const envelope = {
    id: `${channel.name}:${Date.now()}`,
    channel: channel.name,
    publishedAt: Date.now(),
    payload: parsed.payload,
  };
  const targets =
    channel.kind === "queue" ? channel.consumers.slice(-1) : channel.consumers;
  await Promise.all(
    targets.map((consumer) => Promise.resolve(consumer(envelope))),
  );
  return targets.length;
};

const safePayload = (
  channel: CollectedChannel,
  payload: unknown,
): { readonly payload: unknown; readonly error?: unknown } => {
  if (channel.schema === undefined) return { payload };
  const result = channel.schema.safeParse(payload);
  if (result.success) {
    return { payload: result.data };
  }
  return { payload: result.error.issues, error: result.error.issues };
};
