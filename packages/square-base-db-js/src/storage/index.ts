import { StorageObject } from "../types";
import { genUploader } from "uploadthing/client";

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

// Function to fetch data from the API
async function apiFetch<T>(
  url: string,
  apiKey: string,
  init?: RequestInit,
): Promise<StorageResult<T>> {
  try {
    // Fetch the data from the API
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Add any additional headers from the init object
        ...init?.headers,
      },
    });

    // If the response is not ok, return an error
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      // Return the error message
      return { data: null, error: err.message ?? `HTTP ${res.status}` };
    }

    // Parse the response as JSON
    const data = (await res.json()) as T;

    // Return the data and no error
    return { data, error: null };
  } catch (err: unknown) {
    // If an error occurs, return an error message
    const message = err instanceof Error ? err.message : "Unknown error";
    // Return the error message and no data
    return { data: null, error: message };
  }
}

export class StorageBucketRef {
  constructor(
    private projectUrl: string,
    private apiKey: string,
    private bucketName: string,
  ) {}

  // Function to get the base URL for the storage bucket
  private storageBase(): string {
    const bucket = encodeURIComponent(this.bucketName);
    return `${this.projectUrl}/storage/buckets/${bucket}`;
  }

  // Function to list all objects in the storage bucket
  async list(): Promise<StorageResult<StorageObject[]>> {
    return apiFetch<StorageObject[]>(
      `${this.storageBase()}/objects`,
      this.apiKey,
    );
  }

  // Function to upload a file to the storage bucket
  async upload(file: File): Promise<StorageResult<StorageObject>> {
    try {
      // Generate a signed URL for the upload
      const uploadUrl = `${this.storageBase()}/upload`;
      // Generate a uploader for the upload
      const { uploadFiles } = genUploader({
        url: uploadUrl,
      });
      // Upload the file to the storage bucket
      const uploaded = await uploadFiles("bucketUploader", {
        files: [file],
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      // Get the uploaded file
      const utFile = uploaded[0];
      // If no file is returned, return an error
      if (!utFile) {
        return { data: null, error: "No file returned from upload" };
      }

      // Return the uploaded file as a StorageObject
      return apiFetch<StorageObject>(
        `${this.storageBase()}/objects`,
        this.apiKey,
        {
          method: "POST",
          body: JSON.stringify({
            name: utFile.name,
            size: utFile.size,
            type: file.type || "application/octet-stream",
            utKey: utFile.key,
            url: utFile.url,
          }),
        },
      );
    } catch (err: unknown) {
      // If an error occurs, return an error message
      const message =
        err instanceof Error ? err.message : "Unknown error. Upload failed.";
      return { data: null, error: message };
    }
  }

  // Function to remove an object from the storage bucket
  async remove(objectId: string): Promise<StorageResult<{ message: string }>> {
    // Return a message indicating the object has been removed
    return apiFetch<{ message: string }>(
      `${this.projectUrl}/storage/objects/${objectId}`,
      this.apiKey,
      { method: "DELETE" },
    );
  }

  // Function to get a signed URL for a given object ID
  async getSignedUrl(
    objectId: string,
  ): Promise<StorageResult<{ url: string }>> {
    // Return a signed URL for the given object ID
    return apiFetch<{ url: string }>(
      `${this.projectUrl}/storage/objects/${objectId}/signed-url`,
      this.apiKey,
    );
  }
}

export class SquareBaseDbStorage {
  constructor(
    private projectUrl: string,
    private apiKey: string,
  ) {}

  from(bucketName: string): StorageBucketRef {
    return new StorageBucketRef(this.projectUrl, this.apiKey, bucketName);
  }
}
