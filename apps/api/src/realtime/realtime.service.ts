import type { RealtimeEvent } from "@square-base-db/types";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Client, neonConfig } from "@neondatabase/serverless";
import { ConfigService } from "@nestjs/config";
import { TriggerService } from "./trigger.service.js";

neonConfig.webSocketConstructor = WebSocket;

type NotifyCallback = (event: RealtimeEvent) => void;

@Injectable()
export class RealtimeService implements OnModuleDestroy {
  // A map to keep track of listeners for each channel.
  // The key is the channel name, and the value is an object containing the Postgres client
  // and a set of callback functions to be called when a notification is received.
  private listeners = new Map<
    string,
    {
      client: Client;
      callbacks: Set<NotifyCallback>;
    }
  >();

  // The constructor injects the ConfigService to access environment variables.
  constructor(private configService: ConfigService) {}

  // Get the connection string for listening to real-time notifications.
  private getListenConnectionString(): string {
    const realtime = this.configService.get<string>("REALTIME_DATABASE_URL");
    const database = this.configService.get<string>("DATABASE_URL");
    // Use the REALTIME_DATABASE_URL if available, otherwise fall back to DATABASE_URL.
    const url = realtime ?? database;

    // If neither URL is available, throw an error indicating that the database URL is missing.
    if (!url) {
      throw new Error("Missing database URL in environment variables");
    }

    // Clean the URL by removing any "-pooler" suffix and unnecessary query parameters.
    let clean = url.replace("-pooler", "").trim();
    // Remove sslmode and channel_binding query parameters from the URL.
    clean = clean.replace(/([?&])(sslmode|channel_binding)=[^&]+/g, "$1");
    // Remove any trailing '?' or '&' characters from the URL.
    clean = clean.replace(/[?&]$/, "").replace(/\?&/, "?");

    // Return the cleaned connection string to be used for connecting to the Postgres database.
    return clean;
  }

  // Subscribe to real-time notifications for a specific table in a project.
  async subscribe(
    projectId: string,
    tableName: string,
    callback: NotifyCallback,
  ): Promise<void> {
    // Generate the channel name based on the project ID and table name.
    const channel = TriggerService.channelName(projectId, tableName);

    // Check if there is already a listener for this channel.
    const existing = this.listeners.get(channel);
    // If a listener already exists, add the callback to the set of callbacks and return.
    if (existing) {
      existing.callbacks.add(callback);

      return;
    }

    // Create a new Postgres client for listening to notifications on this channel.
    const client = new Client({
      connectionString: this.getListenConnectionString(),
    });

    // Connect the client to the Postgres database.
    await client.connect();

    // Set up an event listener for notifications received on this channel.
    client.on("notification", (msg) => {
      // If the payload is empty, do nothing.
      if (!msg.payload) return;

      // Try to parse the payload as a RealtimeEvent and call all registered callbacks with the event.
      try {
        const event = JSON.parse(msg.payload) as RealtimeEvent;
        const entry = this.listeners.get(channel);

        // Call each callback function registered for this channel with the event.
        entry?.callbacks.forEach((cb) => cb(event));
      } catch {}
    });

    // Start listening to the specified channel for notifications.
    await client.query(`LISTEN ${channel}`);

    // Store the client and the callback in the listeners map for this channel.
    this.listeners.set(channel, {
      client,
      callbacks: new Set([callback]),
    });
  }

  // Unsubscribe from real-time notifications for a specific table in a project.
  unsubscribe(
    projectId: string,
    tableName: string,
    callback: NotifyCallback,
  ): void {
    // Generate the channel name based on the project ID and table name.
    const channel = TriggerService.channelName(projectId, tableName);
    const entry = this.listeners.get(channel);

    // If there is no listener for this channel, do nothing.
    if (!entry) return;

    // Remove the callback from the set of callbacks for this channel.
    entry.callbacks.delete(callback);

    // If there are no more callbacks for this channel, stop listening and clean up.
    if (entry.callbacks.size === 0) {
      void entry.client.query(`UNLISTEN ${channel}`).finally(() => {
        void entry.client.end();
      });

      // Remove the entry from the listeners map to free up resources.
      this.listeners.delete(channel);
    }
  }

  // Clean up all listeners when the module is destroyed.
  // This method is called when the NestJS module is being destroyed,
  // and it ensures that all Postgres clients are properly closed.
  async onModuleDestroy() {
    await Promise.all(
      [...this.listeners.values()].map(({ client }) => client.end()),
    );

    this.listeners.clear();
  }
}
