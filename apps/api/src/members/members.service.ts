import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DrizzleService } from "../db/drizzle.service.js";
import { organizations, orgMembers, users } from "../db/schema/index.js";
import { and, eq, isNull } from "drizzle-orm";
import { UpdateRoleDto } from "./dto/update-role.dto.js";

@Injectable()
export class MembersService {
  constructor(private drizzle: DrizzleService) {}

  // Get all members of an organization by orgSlug
  // This includes their user information and role in the organization
  // Only members that have not been removed (removedAt is null) are returned
  async getMembers(orgSlug: string) {
    return (
      this.drizzle.db
        .select({
          id: orgMembers.id,
          role: orgMembers.role,
          createdAt: orgMembers.createdAt,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(orgMembers)
        // Join with organizations and users to get the necessary information
        .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
        // Join with users to get user information
        .innerJoin(users, eq(orgMembers.userId, users.id))
        // Filter by organization slug and only include members that have not been removed
        .where(
          and(eq(organizations.slug, orgSlug), isNull(orgMembers.removedAt)),
        )
    );
  }

  // Update the role of a member in an organization
  // If the new role is "developer", ensure that the member is not the last admin in the organization
  async updateRole(orgSlug: string, memberId: string, dto: UpdateRoleDto) {
    // If the new role is "developer", ensure that the member is not the last admin in the organization
    if (dto.role === "developer") {
      await this.ensureNotLastAdmin(orgSlug, memberId);
    }

    // Update the role of the member in the database
    const [updated] = await this.drizzle.db
      .update(orgMembers)
      .set({ role: dto.role })
      .where(eq(orgMembers.id, memberId))
      // Return the updated member information, including their user information
      .returning();

    // If no member was updated, throw a NotFoundException
    if (!updated) throw new NotFoundException("Member not found");

    // Return the updated member information
    return updated;
  }

  // Remove a member from an organization
  // This sets the removedAt field to the current date, effectively removing the member from the organization
  async removeMember(orgSlug: string, memberId: string) {
    // Ensure that the member being removed is not the last admin in the organization
    await this.ensureNotLastAdmin(orgSlug, memberId);

    // Update the removedAt field of the member in the database
    const [updated] = await this.drizzle.db
      .update(orgMembers)
      // Set the removedAt field to the current date
      .set({ removedAt: new Date() })
      .where(eq(orgMembers.id, memberId))
      .returning();

    // If no member was updated, throw a NotFoundException
    if (!updated) throw new NotFoundException("Member not found");

    // Return a success message
    return { message: "Member removed successfully" };
  }

  // Ensure that the member being updated is not the last admin in the organization
  // If the member is the last admin, throw a BadRequestException
  private async ensureNotLastAdmin(orgSlug: string, memberId: string) {
    // Get all admins in the organization
    // Only include members that have not been removed (removedAt is null)
    const admins = await this.drizzle.db
      .select({
        id: orgMembers.id,
      })
      .from(orgMembers)
      //  Join with organizations to filter by organization slug
      .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
      // Filter by organization slug, role is "admin", and only include members that have not been removed
      // This will return all admins in the organization that have not been removed
      .where(
        and(
          eq(organizations.slug, orgSlug),
          eq(orgMembers.role, "admin"),
          isNull(orgMembers.removedAt),
        ),
      );

    // Check if the member being updated is an admin and if they are the last admin in the organization
    const targetIsAdmin = admins.some((a) => a.id === memberId);

    // If the member being updated is an admin and they are the last admin in the organization, throw a BadRequestException
    if (targetIsAdmin && admins.length === 1) {
      throw new BadRequestException(
        "Cannot change role of the last admin in the organization",
      );
    }
  }
}
