import {RealtimeEvent} from "../types";
import {io, Socket} from "socket.io-client";
import {REALTIME_EVENTS} from "@square-base-db/constants";

/**
 * Function you pass to subscribe().
 * Called every time a row changes on that table (INSERT / UPDATE / DELETE).
 */
export type RealtimeCallback = (event: RealtimeEvent) => void;

/**
 * Turns the project API URL into the Socket.IO server URL.
 *
 * Example:
 *   projectUrl = "https://api.example.com/v1/proj_abc"
 *   result     = "https://api.example.com/realtime"
 *
 * Your Next.js gateway expects path `/realtime` (not `/realtime/v1` or `/api`).
 */
function getRealtimeSocketUrl(projectUrl: string): string {
  const origin = new URL(projectUrl).origin;
  return `${origin}/realtime`;
}

/**
 * Client for live table updates via Socket.IO.
 *
 * Flow:
 * 1. First subscribe() → open WebSocket, auth with API key
 * 2. Tell server: "SUBSCRIBE to table X"
 * 3. Server pushes REALTIME_EVENTS.EVENT when a row changes
 * 4. We look up callbacks for that table and run them
 *
 * Example:
 *   const realtime = new SquareBaseDbRealtime(url, key);
 *   const unsub = realtime.subscribe("messages", (event) => {
 *     console.log(event.type, event.record); // INSERT, UPDATE, DELETE
 *   });
 *   // later:
 *   unsub(); // or realtime.disconnect()
 */
export class SquareBaseDbRealtime {
  /** Active Socket.IO connection. null until first subscribe(). */
  private socket: Socket | null = null;

  /**
   * table name → set of callbacks
   * One table can have many listeners (e.g. two React components).
   * We only UNSUBSCRIBE on the server when the last callback is removed.
   */
  private callbacks = new Map<string, Set<RealtimeCallback>>();

  /**
   * @param projectUrl - Same base URL as the REST client
   * @param apiKey     - Sent as auth.token so the server knows which project
   */
  constructor(
    private projectUrl: string,
    private apiKey: string,
  ) {
  }

  /**
   * Opens the socket if needed, wires up listeners, returns the socket.
   * Safe to call many times — reuses the same connection.
   */
  private connect(): Socket {
    // Already connected → reuse
    if (this.socket?.connected) return this.socket;

    // Create Socket.IO client
    this.socket = io(getRealtimeSocketUrl(this.projectUrl), {
      auth: {token: this.apiKey}, // server validates this
      transports: ["websocket", "polling"], // prefer WS, fall back to polling
    });

    /**
     * On (re)connect: re-subscribe every table we still care about.
     * Needed because after a disconnect the server forgets our subscriptions.
     */
    this.socket.on("connect", () => {
      for (const table of this.callbacks.keys()) {
        this.socket?.emit(REALTIME_EVENTS.SUBSCRIBE, table);
      }
    });

    /**
     * Server pushes a change event.
     * event.table tells us which table → run only that table's callbacks.
     */
    this.socket.on(REALTIME_EVENTS.EVENT, (event: RealtimeEvent) => {
      const handlers = this.callbacks.get(event.table);
      handlers?.forEach((cb) => cb(event));
    });

    /** Server-side errors (auth failed, bad table name, etc.) */
    this.socket.on(REALTIME_EVENTS.ERROR, (msg: string) => {
      console.error("[SquareBaseDbRealtime] Error:", msg);
    });

    return this.socket;
  }

  /**
   * Listen for changes on a table.
   *
   * @returns unsubscribe function for this specific callback
   *          (same as calling unsubscribe(table, callback))
   *
   * First callback for a table → emit SUBSCRIBE to the server.
   * Extra callbacks for the same table → only stored locally.
   */
  subscribe(table: string, callback: RealtimeCallback): () => void {
    const socket = this.connect();

    // First listener for this table → tell the server we want it
    if (!this.callbacks.has(table)) {
      this.callbacks.set(table, new Set());
      socket.emit(REALTIME_EVENTS.SUBSCRIBE, table);
    }

    this.callbacks.get(table)!.add(callback);

    // Convenience: caller can just run the returned function to unsub
    return () => this.unsubscribe(table, callback);
  }

  /**
   * Stop listening.
   *
   * - unsubscribe("messages")           → remove ALL callbacks for that table
   * - unsubscribe("messages", myCb)     → remove only myCb
   *
   * When the last callback for a table is gone, emit UNSUBSCRIBE
   * so the server stops sending events for that table.
   */
  unsubscribe(table: string, callback?: RealtimeCallback): void {
    // No specific callback → drop the whole table
    if (!callback) {
      this.callbacks.delete(table);
      this.socket?.emit(REALTIME_EVENTS.UNSUBSCRIBE, table);
      return;
    }

    const handlers = this.callbacks.get(table);
    if (!handlers) return;

    handlers.delete(callback);

    // Last callback removed → leave the table on the server too
    if (handlers.size === 0) {
      this.callbacks.delete(table);
      this.socket?.emit(REALTIME_EVENTS.UNSUBSCRIBE, table);
    }
  }

  /**
   * Close the socket and clear all local listeners.
   * Call this on app logout / unmount of the root provider.
   */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.callbacks.clear();
  }
}