export { hub } from "./hub.js";
export type { RealtimeHub } from "./hub.js";

export { socketsOf } from "./collector.js";
export type { CollectedSocket } from "./collector.js";

export { socket } from "./socket.js";
export type {
  RealtimeEventDescriptor,
  RealtimeEventKind,
  RealtimeMessageContext,
  RealtimeMessageHandler,
  RealtimeSocketBuilder,
  RealtimeSocketDescriptor,
} from "./socket.js";

import { socketsOf } from "./collector.js";
import { hub } from "./hub.js";
import { socket } from "./socket.js";

/**
 * The realtime namespace: one import for the whole realtime app extensor —
 * socket builders, the runtime hub, and the collector.
 *
 * @group Surface
 * @example Declare a realtime bundle
 */
export const realtime = {
  hub,
  socket,
  socketsOf,
};
