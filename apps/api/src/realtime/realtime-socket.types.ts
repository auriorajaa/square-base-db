import { PROJECT_KEY_ROLES } from "@square-base-db/constants";
import { DefaultEventsMap, Socket } from "socket.io";

export interface RealtimeSocketTypes {
  projectId: string;
  role?: (typeof PROJECT_KEY_ROLES)[keyof typeof PROJECT_KEY_ROLES];
}

export type RealtimeSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  RealtimeSocketTypes
>;
