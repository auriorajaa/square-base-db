import { StorageObject } from "@square-base-db/types";

type StorageUploadRouter = {
  bucketUploader: {
    input: undefined;
    output: null;
  };
};

export interface StorageResult<T> {
  data: T | null;
  error: string | null;
}

async function apiFetch<T>(
  url: string,
  apiKey: string,
  init?: RequestInit,
): Promise<StorageResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };

      return { data: null, error: err.message ?? `HTTP ${res.status}` };
    }

    const data = (await res.json()) as T;

    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    return { data: null, error: message };
  }
}

export class StorageBucketRef {
  constructor(
    private projectUrl: string,
    private apiKey: string,
    private bucketName: string,
  ) {}

  private storageBase(): string {
    const bucket = encodeURIComponent(this.bucketName);
    return `${this.projectUrl}/storage/buckets/${bucket}`;
  }

  async list(): Promise<StorageResult<StorageObject[]>> {
    return apiFetch<StorageObject[]>(
      `${this.storageBase()}/objects`,
      this.apiKey,
    );
  }
}
