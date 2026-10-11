import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DrizzleService } from "../db/drizzle.service.js";
import { UTApi } from "uploadthing/server";
import {
  organizations,
  projects,
  storageBuckets,
  storageObjects,
} from "../db/schema/index.js";
import { and, eq } from "drizzle-orm";
import type { BucketAccess } from "@square-base-db/types";

@Injectable()
export class StorageService {
  // For interacting with UploadThing API
  private utapi = new UTApi();

  constructor(private drizzle: DrizzleService) {}

  // Helper method to get project by orgSlug and projectSlug
  private async getProject(orgSlug: string, projectSlug: string) {
    // Get the project ID based on orgSlug and projectSlug
    // This is used to ensure that the bucket belongs to the correct project and organization
    // We use an inner join to ensure that the project belongs to the organization
    const [row] = await this.drizzle.db
      .select({ id: projects.id })
      .from(projects)
      .innerJoin(organizations, eq(projects.orgId, organizations.id))
      .where(
        and(eq(organizations.slug, orgSlug), eq(projects.slug, projectSlug)),
      )
      .limit(1);

    // If no project is found, throw a NotFoundException
    if (!row) throw new NotFoundException("Project not found");

    // Return the project ID
    return row;
  }

  // Finds a bucket by ID, but only if it belongs to the project in the URL.
  // Without this check, a member of one org could pass a bucket ID that
  // belongs to another org's project and read/modify it.
  async getBucketInProject(
    orgSlug: string,
    projectSlug: string,
    bucketId: string,
  ) {
    const project = await this.getProject(orgSlug, projectSlug);

    const [bucket] = await this.drizzle.db
      .select()
      .from(storageBuckets)
      .where(
        and(
          eq(storageBuckets.id, bucketId),
          eq(storageBuckets.projectId, project.id),
        ),
      )
      .limit(1);

    if (!bucket) throw new NotFoundException("Bucket not found");

    return bucket;
  }

  // Finds an object by ID, but only if its bucket belongs to the project in the URL.
  private async getObjectInProject(
    orgSlug: string,
    projectSlug: string,
    objectId: string,
  ) {
    const project = await this.getProject(orgSlug, projectSlug);

    const [row] = await this.drizzle.db
      .select({ object: storageObjects })
      .from(storageObjects)
      .innerJoin(storageBuckets, eq(storageObjects.bucketId, storageBuckets.id))
      .where(
        and(
          eq(storageObjects.id, objectId),
          eq(storageBuckets.projectId, project.id),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException("File not found");

    return row.object;
  }

  // Get all buckets for a given organization and project
  async getBuckets(orgSlug: string, projectSlug: string) {
    const project = await this.getProject(orgSlug, projectSlug);
    return this.drizzle.db
      .select()
      .from(storageBuckets)
      .where(eq(storageBuckets.projectId, project.id));
  }

  // Create a new bucket for a given organization and project
  async createBucket(
    orgSlug: string,
    projectSlug: string,
    name: string,
    access: BucketAccess,
  ) {
    // Get the project ID based on orgSlug and projectSlug
    const project = await this.getProject(orgSlug, projectSlug);

    // Trim the bucket name to remove any leading or trailing whitespace
    // If the trimmed name is empty, throw a BadRequestException
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException("Bucket name cannot be empty");
    }

    // Insert the new bucket into the storageBuckets table and return the created bucket
    const [bucket] = await this.drizzle.db
      .insert(storageBuckets)
      .values({ projectId: project.id, name: trimmed, access })
      .returning();

    // Return the created bucket
    return bucket;
  }

  // Delete a bucket and all its associated objects
  async deleteBucket(orgSlug: string, projectSlug: string, bucketId: string) {
    // Make sure the bucket belongs to this project before touching anything
    const bucket = await this.getBucketInProject(
      orgSlug,
      projectSlug,
      bucketId,
    );

    // Get all objects associated with the bucket
    // We need to delete the objects from UploadThing before deleting the bucket
    const objects = await this.drizzle.db
      .select({ utKey: storageObjects.utKey })
      .from(storageObjects)
      .where(eq(storageObjects.bucketId, bucket.id));

    // If there are any objects, delete them from UploadThing
    if (objects.length > 0) {
      await this.utapi.deleteFiles(objects.map((o) => o.utKey));
    }

    // Delete the bucket from the storageBuckets table
    await this.drizzle.db
      .delete(storageBuckets)
      .where(eq(storageBuckets.id, bucket.id));

    return { message: "Bucket deleted successfully" };
  }

  // Get all objects for a given bucket
  async getObjects(orgSlug: string, projectSlug: string, bucketId: string) {
    const bucket = await this.getBucketInProject(
      orgSlug,
      projectSlug,
      bucketId,
    );

    return this.drizzle.db
      .select()
      .from(storageObjects)
      .where(eq(storageObjects.bucketId, bucket.id));
  }

  // Save an object to the storageObjects table
  async saveObjects(
    orgSlug: string,
    projectSlug: string,
    bucketId: string,
    // The file object contains the following properties:
    // name: The name of the file
    // size: The size of the file in bytes
    // type: The MIME type of the file
    // utKey: The UploadThing key for the file
    // url: The URL of the file (if public)
    file: {
      name: string;
      size: number;
      type: string;
      utKey: string;
      url: string;
    },
  ) {
    // Get the bucket (scoped to this project) to check its access level
    const bucket = await this.getBucketInProject(
      orgSlug,
      projectSlug,
      bucketId,
    );

    // If the bucket is public, use the file URL; otherwise, set the URL to an empty string
    const url = bucket.access === "public" ? file.url : "";

    // Insert the object into the storageObjects table and return the created object
    const [object] = await this.drizzle.db
      .insert(storageObjects)
      .values({
        bucketId: bucket.id,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        utKey: file.utKey,
        url,
      })
      .returning();

    // Return the created object
    return object;
  }

  // Delete an object from the storageObjects table and UploadThing
  async deleteObject(orgSlug: string, projectSlug: string, objectId: string) {
    const object = await this.getObjectInProject(
      orgSlug,
      projectSlug,
      objectId,
    );

    // Delete the object from UploadThing using the utKey
    await this.utapi.deleteFiles(object.utKey);

    // Delete the object from the storageObjects table
    await this.drizzle.db
      .delete(storageObjects)
      .where(eq(storageObjects.id, object.id));

    return { message: "File deleted successfully" };
  }

  // Generate a signed URL for an object
  async getSignedUrl(orgSlug: string, projectSlug: string, objectId: string) {
    const object = await this.getObjectInProject(
      orgSlug,
      projectSlug,
      objectId,
    );

    // Generate a signed URL for the object using the utKey
    // The signed URL will expire in 1 hour (3600 seconds)
    const { ufsUrl } = await this.utapi.generateSignedURL(object.utKey, {
      expiresIn: 3600,
    });

    // Return the signed URL
    return { url: ufsUrl };
  }
}
