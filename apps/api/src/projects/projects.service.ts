import { Injectable, NotFoundException } from "@nestjs/common";
import { DrizzleService } from "../db/drizzle.service.js";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import slugify from "slugify";
import { randomBytes } from "crypto";
import { organizations, orgMembers, projects } from "../db/schema/index.js";
import { and, eq, isNull } from "drizzle-orm";
import { CreateProjectDto } from "./dto/create-project.dto.js";
import { PROJECT_KEY_ROLES } from "@square-base-db/constants";

@Injectable()
export class ProjectsService {
  constructor(
    private drizzle: DrizzleService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // Generate a unique slug for the project based on its name and a random suffix
  private generateProjectSlug(name: string): string {
    const base = slugify(name, { lower: true, strict: true });
    const suffix = randomBytes(3).toString("hex");

    return `${base}-${suffix}`;
  }

  // Generate a unique database schema name for the project
  private generateDbSchema(): string {
    return `proj_${randomBytes(4).toString("hex")}`;
  }

  // Sign a JWT for the project with the given role (anon or service_role)
  // The token will contain the projectId and role in its payload
  private signProjectKey(projectId: string, role: string): string {
    return this.jwtService.sign(
      { projectId, role },
      {
        secret: this.configService.get<string>("PROJECT_JWT_SECRET"),
        // Set a long expiration time for the project keys (100 years)
        expiresIn: "100y",
      },
    );
  }

  // Provision a new database schema for the project
  // This will create a new schema in the database if it doesn't already exist
  private async provisionSchema(dbSchema: string): Promise<void> {
    await this.drizzle.db.execute(`CREATE SCHEMA IF NOT EXISTS "${dbSchema}"`);
  }

  // Get all projects for a given organization slug and user ID
  // This will return only the projects that the user is a member of the organization
  // The user must be a member of the organization to see its projects
  async getProjectForOrg(orgSlug: string, userId: string) {
    return (
      this.drizzle.db
        .select({
          id: projects.id,
          name: projects.name,
          slug: projects.slug,
          projectUrl: projects.projectUrl,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        })
        .from(projects)
        // Join the organizations table to get the organization ID for the project
        .innerJoin(organizations, eq(projects.orgId, organizations.id))
        // Join the orgMembers table to check if the user is a member of the organization
        .innerJoin(
          orgMembers,
          and(
            eq(orgMembers.orgId, organizations.id),
            eq(orgMembers.userId, userId),
            // Check if the user is not removed from the organization
            isNull(orgMembers.removedAt),
          ),
        )
        // Filter the projects by the organization slug
        .where(eq(organizations.slug, orgSlug))
    );
  }

  // Get a single project by its slug and organization slug for a given user ID
  // This will return the project only if the user is a member of the organization
  // If the project is not found or the user is not a member, it will throw a NotFoundException
  async getProjectBySlug(orgSlug: string, projectSlug: string, userId: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(projects)
      // Join the organizations table to get the organization ID for the project
      .innerJoin(organizations, eq(projects.orgId, organizations.id))
      // Join the orgMembers table to check if the user is a member of the organization
      .innerJoin(
        orgMembers,
        and(
          eq(orgMembers.orgId, organizations.id),
          eq(orgMembers.userId, userId),
          isNull(orgMembers.removedAt),
        ),
      )
      // Filter the projects by the organization slug and project slug
      .where(
        and(eq(organizations.slug, orgSlug), eq(projects.slug, projectSlug)),
      )
      // Limit the result to 1 row since we expect only one project to match
      .limit(1);

    // If no project is found, throw a NotFoundException
    if (!row) throw new NotFoundException("Project not found");

    // Return the found project row
    return row;
  }

  // Create a new project for a given organization slug and project data transfer object (DTO)
  // This will create a new project in the database and provision a new schema for it
  // It will also generate anon and service role keys for the project
  async createProject(orgSlug: string, dto: CreateProjectDto) {
    // Find the organization by its slug
    const [org] = await this.drizzle.db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);

    // If the organization is not found, throw a NotFoundException
    if (!org) throw new NotFoundException("Organization not found");

    // Generate a unique slug for the project based on its name
    const projectSlug = this.generateProjectSlug(dto.name);
    // Generate a unique database schema name for the project
    const dbSchema = this.generateDbSchema();
    // Construct the project URL using the API URL from the configuration and the project slug
    const projectUrl = `${this.configService.get<string>("API_URL")}/projects/${projectSlug}`;

    // Provision the new database schema for the project
    await this.provisionSchema(dbSchema);

    // Generate a random JWT secret for the project
    const authJwtSecret = randomBytes(32).toString("hex");

    // Insert the new project into the database and return the created project
    const [project] = await this.drizzle.db
      .insert(projects)
      .values({
        orgId: org.id,
        name: dto.name,
        slug: projectSlug,
        // Store the generated database schema name and project URL in the database
        dbSchema,
        // Store the project URL in the database for easy access
        projectUrl,
        // Initialize the anon and service role keys as empty strings for now
        anonKey: "",
        // Initialize the service role key as an empty string for now
        serviceRoleKey: "",
        // Store the generated JWT secret in the database
        authJwtSecret,
      })
      // Return the created project row after insertion
      .returning();

    // Generate the anon and service role keys for the project using JWT signing
    const anonKey = this.signProjectKey(project.id, PROJECT_KEY_ROLES.ANON);
    //  Generate the service role key for the project using JWT signing
    const serviceRoleKey = this.signProjectKey(
      project.id,
      // Use the constant for the service role key to ensure consistency
      PROJECT_KEY_ROLES.SERVICE_ROLE,
    );

    // Update the project in the database with the generated anon and service role keys
    const [updated] = await this.drizzle.db
      .update(projects)
      // Set the anon and service role keys in the database for the project
      .set({ anonKey, serviceRoleKey })
      // Filter the update to only affect the newly created project by its ID
      .where(eq(projects.id, project.id))
      // Return the updated project row after the update
      .returning();

    // Return the updated project with the generated keys to the caller
    return updated;
  }
}
