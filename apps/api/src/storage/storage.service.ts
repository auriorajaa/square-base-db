import { Injectable, NotFoundException } from "@nestjs/common";
import { DrizzleService } from "../db/drizzle.service.js";
import { UTApi } from "uploadthing/server";
import { organizations, projects } from "../db/schema/index.js";
import { and, eq } from "drizzle-orm";

@Injectable()
export class StorageService {
  private utapi = new UTApi();

  constructor(private drizzle: DrizzleService) {}

  private async getProject(orgSlug: string, projectSlug: string) {
    const [row] = await this.drizzle.db
      .select({ id: projects.id })
      .from(projects)
      .innerJoin(organizations, eq(projects.orgId, organizations.id))
      .where(
        and(eq(organizations.slug, orgSlug), eq(projects.slug, projectSlug)),
      )
      .limit(1);

    if (!row) throw new NotFoundException("Project not found");
    return row;
  }
}
