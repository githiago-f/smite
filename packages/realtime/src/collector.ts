import { childrenOf } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import type { RealtimeEventKind } from "./socket.js";

/**
 * A realtime socket as seen by artifact generators: its name and the
 * lifecycle/message events declared on it.
 *
 * @group Collector
 */
export interface CollectedSocket {
  readonly name: string;
  readonly events: readonly RealtimeEventKind[];
}

type SocketNode = Descriptor<"realtime.socket", { name: string }>;
type EventNode = Descriptor<"realtime.event", { event: RealtimeEventKind }>;

/**
 * Walks an app's `realtime.socket` children and returns the collected sockets
 * with the events they handle. Shared by artifact generators and the hub
 * executor.
 *
 * @group Collector
 * @example Collect an app's sockets
 */
export function socketsOf(app: AppDescriptor): readonly CollectedSocket[] {
  return childrenOf(app, "realtime.socket").map((node) => {
    const socketNode = node as SocketNode;
    return {
      name: socketNode.data.name,
      events: (childrenOf(node, "realtime.event") as readonly EventNode[]).map(
        (event) => event.data.event,
      ),
    };
  });
}
