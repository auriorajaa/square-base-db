export type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE";

export interface RealtimeEvent {
  type: RealtimeEventType;
  table: string;
  record: Record<string, unknown>;
  oldRecord?: Record<string, unknown>;
  projectId: string;
  timestamp: string;
}

export interface StorageObject {
  id: string;
  bucketId: string;
  name: string;
  size: number;
  mimeType: string;
  utKey: string;
  url: string;
  createdAt: string;
}
