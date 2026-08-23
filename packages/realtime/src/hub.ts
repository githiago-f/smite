import { childrenOf, finalizeDescriptor } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import { socketsOf } from "./collector.js";
import type { CollectedSocket } from "./collector.js";
import type { RealtimeEventKind } from "./socket.js";

type SocketNode = Descriptor<"realtime.socket", { name: string }>;
type EventNode = Descriptor<
  "realtime.event",
  { event: RealtimeEventKind; fn: unknown }
>;

/**
 * A runtime handle returned by {@link realtime}. The transport (a WebSocket
 * server, SSE) decides *when*; the hub decides *what runs*.
 *
 * @group Executor
 */
export interface RealtimeHub {
  readonly sockets: readonly CollectedSocket[];
  /** Opens a connection, returns the connection id, runs `connect` handlers. */
  readonly connect: (socket: string, connection: string) => Promise<string>;
  /** Fires a socket's `message` handlers with `{ connection, payload }`. */
  readonly emit: (socket: string, payload: unknown) => Promise<number>;
  /** Closes a connection and runs the socket's `disconnect` handlers. */
  readonly disconnect: (socket: string, connection: string) => Promise<number>;
}

/**
 * Turns an app into a runtime realtime hub. Walks the app's `realtime.socket`
 * IR tree via child refs — never the registry — and drives each socket's
 * `connect`, `message`, and `disconnect` events on demand.
 *
 * @group Executor
 * @example Drive a socket's events
 */
export function hub(
  app: AppDescriptor,
  options: { readonly onError?: (error: unknown) => void } = {},
): RealtimeHub {
  finalizeDescriptor(app);
  const sockets = socketsOf(app);
  const socketNodes = childrenOf(
    app,
    "realtime.socket",
  ) as readonly SocketNode[];

  const eventsOf = (socket: string): readonly EventNode[] => {
    const node = socketNodes.find(
      (candidate) => candidate.data.name === socket,
    );
    if (node === undefined) return [];
    return childrenOf(node, "realtime.event") as readonly EventNode[];
  };

  const fire = async (
    socket: string,
    event: RealtimeEventKind,
    context: unknown,
  ): Promise<number> => {
    const targets = eventsOf(socket).filter(
      (entry) => entry.data.event === event,
    );
    if (targets.length === 0) return 0;
    const fn = targets[0]?.data.fn as ((value: unknown) => unknown) | undefined;
    if (typeof fn !== "function") return 0;
    try {
      await Promise.resolve(fn(context));
    } catch (error) {
      options.onError?.(error);
    }
    return targets.length;
  };

  return {
    sockets,
    connect: async (socket, connection) => {
      await fire(socket, "connect", { connection });
      return connection;
    },
    emit: async (socket, payload) =>
      fire(socket, "message", { connection: socket, payload }),
    disconnect: async (socket, connection) =>
      fire(socket, "disconnect", { connection }),
  };
}
