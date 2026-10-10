import { createUploadthing, type FileRouter } from "uploadthing/express";
import type { FileRoute } from "uploadthing/types";

const f = createUploadthing();

export const storageRouter: {
  bucketUploader: FileRoute<{
    input: undefined;
    output: null;
    errorShape: any;
  }>;
} = {
  bucketUploader: f({
    blob: {
      maxFileSize: "512MB",
      maxFileCount: 10,
    },
  }).onUploadComplete((data) => {
    console.log("Upload complete for files:", data.file.name);
  }),
} satisfies FileRouter;

export type OurStorageRouter = typeof storageRouter;
