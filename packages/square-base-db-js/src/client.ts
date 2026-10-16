import { SquareBaseDbAuth } from "./auth";
import { SquareBaseDb } from "./db";
import { SquareBaseDbRealtime } from "./realtime";
import { SquareBaseDbStorage } from "./storage";

export class SquareBaseDbClient {
  readonly db: SquareBaseDb;
  readonly storage: SquareBaseDbStorage;
  readonly realtime: SquareBaseDbRealtime;
  readonly auth: SquareBaseDbAuth;

  constructor(projectUrl: string, apiKey: string) {
    this.db = new SquareBaseDb(projectUrl, apiKey);
    this.storage = new SquareBaseDbStorage(projectUrl, apiKey);
    this.realtime = new SquareBaseDbRealtime(projectUrl, apiKey);
    this.auth = new SquareBaseDbAuth(projectUrl);
  }

  from<T = Record<string, unknown>>(table: string) {
    return this.db.from<T>(table);
  }
}
