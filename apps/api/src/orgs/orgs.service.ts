import { Injectable, NotFoundException } from "@nestjs/common";
import { DrizzleService } from "../db/drizzle.service.js";
import slugify from "slugify";
import { randomBytes } from "crypto";
import { organizations, orgMembers, projects } from "../db/schema/index.js";
import { and, eq, isNull, sql } from "drizzle-orm";
import { CreateOrgDto } from "./dto/create-org.dto.js";

@Injectable()
export class OrgsService {
  constructor(private drizzle: DrizzleService) {}

  // Generate a unique slug for the organization based on its name
  private generateOrgSlug(name: string): string {
    // Use slugify to create a base slug from the organization name
    const base = slugify(`${name}-org`, { lower: true, strict: true });
    // Append a random 3-byte hex string to ensure uniqueness
    const suffix = randomBytes(3).toString("hex");

    // Return the final slug in the format: base-suffix
    return `${base}-${suffix}`;
  }

  // Get all organizations for a user, including their role, project count, and member count
  async getMyOrgs(userId: string) {
    // Select the organization details, role, project count, and member count for the given user
    // The query joins the orgMembers table with organizations and projects,
    // filters by userId, and groups by organization ID and role
    // The member count is calculated using a subquery that counts the number of members in the organization
    // The project count is calculated by counting distinct projects associated with the organization
    // The result is returned as an array of organizations with their respective metadata
    return (
      this.drizzle.db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          createdAt: organizations.createdAt,
          updatedAt: organizations.updatedAt,
          role: orgMembers.role,
          // Count the number of distinct projects associated with each organization
          projectCount: sql<number>`cast(count(distinct ${projects.id}) as int)`,
          // Count the number of members in each organization using a subquery
          // The subquery selects the count of members from the org_members table
          // where the org_id matches the current organization ID and the member has not been removed
          memberCount: sql<number>`(
        select cast(count(*) as int)
        from org_members om
        where om.org_id = ${organizations.id}
        and om.removed_at is null
      )`,
        })
        .from(orgMembers)
        // Join the organizations table to get organization details for the user's memberships
        .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
        // Join the projects table to count the number of distinct projects associated with each organization
        .leftJoin(projects, eq(projects.orgId, organizations.id))
        // Filter the results to include only the organizations where the user is a member and has not been removed
        .where(and(eq(orgMembers.userId, userId), isNull(orgMembers.removedAt)))
        // Group the results by organization ID and role to ensure accurate counts for each organization
        .groupBy(organizations.id, orgMembers.role)
    );
  }

  // Get a specific organization by its slug for a user, including their role
  async getOrgBySlug(slug: string, userId: string) {
    // Select the organization details and role for the given user and slug
    // The query joins the orgMembers table with organizations,
    // filters by userId and slug, and checks that the member has not been removed
    const [row] = await this.drizzle.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
        role: orgMembers.role,
      })
      .from(organizations)
      // Join the orgMembers table to get the user's role in the organization
      // The join condition ensures that the organization ID matches,
      // the user ID matches, and the member has not been removed
      .innerJoin(
        orgMembers,
        and(
          eq(orgMembers.orgId, organizations.id),
          eq(orgMembers.userId, userId),
          isNull(orgMembers.removedAt),
        ),
      )
      // Filter the results to include only the organization with the specified slug
      .where(eq(organizations.slug, slug))
      // Limit the result to a single organization, as slugs are unique
      .limit(1);

    // If no organization is found, throw a NotFoundException
    if (!row) throw new NotFoundException("Organization not found");

    // Return the organization details along with the user's role
    return row;
  }

  // Create a new organization and assign the user as an admin
  async createOrg(dto: CreateOrgDto, userId: string) {
    // Insert a new organization into the database with the provided name and a generated slug
    // The returning() method retrieves the newly created organization record
    const [org] = await this.drizzle.db
      .insert(organizations)
      .values({
        name: dto.name,
        slug: this.generateOrgSlug(dto.name),
      })
      .returning();

    // Insert the user as an admin member of the newly created organization
    await this.drizzle.db.insert(orgMembers).values({
      orgId: org.id,
      userId,
      role: "admin",
    });

    // Return the newly created organization details
    return org;
  }
}
