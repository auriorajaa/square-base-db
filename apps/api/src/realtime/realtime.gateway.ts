import type { RealtimeEvent } from "@square-base-db/types";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PROJECT_KEY_ROLES, REALTIME_EVENTS } from "@square-base-db/constants";
import { ProjectKeyPayload } from "../project-api/project-key.guard.js";
import { RealtimeService } from "./realtime.service.js";
import type { RealtimeSocket } from "./realtime-socket.types.js";

type SocketCallbackEntry = {
  projectId: string;
  tableName: string;
  callback: (event: RealtimeEvent) => void;
};

// A WebSocket gateway for handling real-time events.
// Clients can connect to this gateway and subscribe to real-time updates for specific tables in a project.
@WebSocketGateway({
  // The namespace for the WebSocket gateway. Clients will connect to this namespace.
  namespace: "/realtime",
  cors: {
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  // The WebSocket server instance, injected by NestJS.
  @WebSocketServer()
  server!: Server;

  // A map to keep track of socket callbacks for each connected client.
  private socketCallbacks = new Map<string, SocketCallbackEntry[]>();

  constructor(
    private realtimeService: RealtimeService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // Handle a new client connection to the WebSocket gateway.
  async handleConnection(client: RealtimeSocket) {
    // Get the token from the client's handshake authentication data.
    const token = client.handshake.auth["token"] as string | undefined;

    // If the token is missing, emit an error event and disconnect the client.
    if (!token) {
      client.emit(REALTIME_EVENTS.ERROR, "Missing API key or token");
      client.disconnect();
      return;
    }

    try {
      // Verify the JWT token using the configured secret and extract the payload.
      const payload = this.jwtService.verify<ProjectKeyPayload>(token, {
        secret: this.configService.get<string>("PROJECT_JWT_SECRET"),
      });

      // Check if the role in the payload is valid (either ANON or SERVICE_ROLE). If not, throw an error.
      if (
        payload.role !== PROJECT_KEY_ROLES.ANON &&
        payload.role !== PROJECT_KEY_ROLES.SERVICE_ROLE
      ) {
        throw new Error("Invalid project key role");
      }

      // Store the projectId and role in the client's data for later use.
      client.data.projectId = payload.projectId;
      client.data.role = payload.role;

      // Join the client to a room specific to the project, allowing for targeted event broadcasting.
      await client.join(`project:${payload.projectId}`);
    } catch {
      // If the token verification fails, emit an error event and disconnect the client.
      client.emit(REALTIME_EVENTS.ERROR, "Invalid API key or token");
      client.disconnect();
    }
  }

  // Handle client disconnection from the WebSocket gateway.
  handleDisconnect(client: Socket) {
    // Retrieve the list of callbacks associated with the disconnected client.
    const callbacks = this.socketCallbacks.get(client.id) ?? [];

    // Unsubscribe from all real-time updates for the tables the client was subscribed to.
    for (const { projectId, tableName, callback } of callbacks) {
      this.realtimeService.unsubscribe(projectId, tableName, callback);
    }

    // Remove the client's callbacks from the map to clean up resources.
    this.socketCallbacks.delete(client.id);
  }

  // Handle a subscription request from the client to receive real-time updates for a specific table.
  // The client sends a message with the table name they want to subscribe to.
  // The server verifies the projectId and tableName, joins the client to a room for that table,
  // and sets up a callback to emit events to the client.
  @SubscribeMessage(REALTIME_EVENTS.SUBSCRIBE)
  async handleSubscribe(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() tableName: string,
  ) {
    // Retrieve the projectId from the client's data. If it's missing or the tableName is empty, return early.
    const projectId = client.data.projectId;
    if (!projectId || !tableName.trim()) return;

    // Normalize the table name by trimming whitespace and construct a room name for the project and table.
    const normalizedTable = tableName.trim();
    const room = `project:${projectId}:table:${normalizedTable}`;

    // Check if the client is already subscribed to this table. If so, return early to avoid duplicate subscriptions.
    const existing = this.socketCallbacks.get(client.id) ?? [];

    // If the client is already subscribed to this table, do not subscribe again.
    if (
      existing.some(
        (entry) =>
          entry.projectId === projectId && entry.tableName === normalizedTable,
      )
    ) {
      return;
    }

    // Join the client to the room for the specified project and table.
    await client.join(room);

    // Set up a callback function that will be called whenever a real-time event occurs for the subscribed table.
    const callback = (event: RealtimeEvent) => {
      this.server.to(room).emit(REALTIME_EVENTS.EVENT, event);
    };

    // Subscribe to real-time updates for the specified project and table using the RealtimeService.
    await this.realtimeService.subscribe(projectId, normalizedTable, callback);

    // Store the subscription information in the socketCallbacks map for the client.
    existing.push({
      projectId,
      tableName: normalizedTable,
      callback,
    });

    // Update the socketCallbacks map with the new subscription entry for the client.
    this.socketCallbacks.set(client.id, existing);
  }

  // Handle an unsubscription request from the client to stop receiving real-time updates for a specific table.
  // The client sends a message with the table name they want to unsubscribe from.
  @SubscribeMessage(REALTIME_EVENTS.UNSUBSCRIBE)
  async handleUnsubscribe(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() tableName: string,
  ) {
    // Retrieve the projectId from the client's data. If it's missing or the tableName is empty, return early.
    const projectId = client.data.projectId;
    if (!projectId || !tableName?.trim()) return;

    // Normalize the table name by trimming whitespace and construct a room name for the project and table.
    const normalizedTable = tableName.trim();
    const room = `project:${projectId}:table:${normalizedTable}`;

    // Leave the room for the specified project and table, effectively unsubscribing the client from real-time updates.
    await client.leave(room);

    // Retrieve the list of callbacks associated with the client and find the entry for the specified project and table.
    const callbacks = this.socketCallbacks.get(client.id) ?? [];
    const entry = callbacks.find(
      (c) => c.projectId === projectId && c.tableName === normalizedTable,
    );

    // If an entry is found, unsubscribe from real-time updates for the specified project and table using the RealtimeService.
    if (entry) {
      this.realtimeService.unsubscribe(
        projectId,
        normalizedTable,
        entry.callback,
      );
      // Remove the entry from the socketCallbacks map for the client.
      this.socketCallbacks.set(
        client.id,
        callbacks.filter((c) => c !== entry),
      );
    }
  }
}
