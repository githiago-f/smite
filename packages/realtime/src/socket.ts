import { defineDescriptor, relate } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import type { EmptyHandler } from "@smitejs/handlers";
import { emptyHandler } from "@smitejs/handlers";

/**
 * A lifecycle or message event on a realtime socket. `connect` and `disconnect`
 * are zero-input handlers; `message` also receives the payload.
 *
 * @group Types
 */
export type RealtimeEventKind = "connect" | "disconnect" | "message";

/**
 * The context a realtime message handler receives.
 *
 * @group Types
 */
export interface RealtimeMessageContext {
  readonly connection: string;
  readonly payload: unknown;
}

/**
 * A handler for a realtime `message` event.
 *
 * @group Types
 */
export type RealtimeMessageHandler = (
  context: RealtimeMessageContext,
) => void | Promise<void>;

/**
 * A `realtime.socket` IR node.
 *
 * @group Internals
 */
export interface RealtimeSocketDescriptor
  extends Descriptor<"realtime.socket", { readonly name: string }> {}

/**
 * A node wrapping the function for one `connect`, `message`, or `disconnect`
 * event.
 *
 * @group Internals
 */
export interface RealtimeEventDescriptor
  extends Descriptor<
    "realtime.event",
    {
      readonly event: RealtimeEventKind;
      readonly fn: EmptyHandler | RealtimeMessageHandler;
    }
  > {}

/**
 * A realtime socket builder: attach handlers from one shared
 * `socket(app, name)` piece. Each `on*` relates a `realtime.event` child under
 * the socket node; the same builder composes all three kinds.
 *
 * @group Builders
 */
export interface RealtimeSocketBuilder {
  /** Registers a zero-input handler for the socket `connect` event. */
  readonly onConnect: (fn: EmptyHandler) => RealtimeSocketBuilder;
  /** Registers a handler receiving `{ connection, payload }` for `message`. */
  readonly onMessage: (fn: RealtimeMessageHandler) => RealtimeSocketBuilder;
  /** Registers a zero-input handler for the socket `disconnect` event. */
  readonly onDisconnect: (fn: EmptyHandler) => RealtimeSocketBuilder;
  /** The underlying `realtime.socket` IR node. */
  readonly node: RealtimeSocketDescriptor;
}

/**
 * Creates a realtime socket builder for an app. The shared `(app, name)` piece
 * yields a builder that attaches `realtime.event` children for `connect`,
 * `message`, and `disconnect`, related under the app's `realtime.socket` node.
 *
 * @group Builders
 * @example Define a socket
 */
export function socket(
  app: AppDescriptor,
  name: string,
): RealtimeSocketBuilder {
  const descriptor = defineDescriptor(
    "realtime.socket",
    `${app.__key}:socket:${name}`,
    { name },
  );
  relate(app, "realtime.socket", descriptor);

  const addEvent = (event: RealtimeEventKind, fn: unknown): void => {
    const eventNode = defineDescriptor(
      "realtime.event",
      `${descriptor.__key}:event:${event}`,
      { event, fn },
    );
    relate(descriptor, "realtime.event", eventNode);
  };

  const builder: RealtimeSocketBuilder = {
    node: descriptor,
    onConnect: (fn) => {
      addEvent("connect", emptyHandler({ name: `socket:${name}` }, fn));
      return builder;
    },
    onMessage: (fn) => {
      addEvent("message", fn);
      return builder;
    },
    onDisconnect: (fn) => {
      addEvent("disconnect", emptyHandler({ name: `socket:${name}` }, fn));
      return builder;
    },
  };
  return builder;
}
