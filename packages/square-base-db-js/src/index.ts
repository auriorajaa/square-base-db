import { SquareBaseDbClient } from "./client";

export function createClient(
  projectUrl: string,
  apiKey: string,
): SquareBaseDbClient {
  return new SquareBaseDbClient(projectUrl, apiKey);
}

export { SquareBaseDbClient } from "./client";
export { QueryBuilder, SquareBaseDb } from "./db";
export type { QueryResult } from "./db";
export { SquareBaseDbRealtime } from "./realtime";
export type { RealtimeCallback } from "./realtime";
export { SquareBaseDbStorage } from "./storage";
export { SquareBaseDbAuth } from "./auth";
