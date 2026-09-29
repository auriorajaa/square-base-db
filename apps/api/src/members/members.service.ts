import { Injectable, NotFoundException } from "@nestjs/common";
import { DrizzleService } from "../db/drizzle.service.js";
import { organizations, orgMembers, users } from "../db/schema/index.js";
import { and, eq, isNull } from "drizzle-orm";
import { UpdateRoleDto } from "./dto/update-role.dto.js";

@Injectable()
export class MembersService {
  constructor(private drizzle: DrizzleService) {}

  async getMembers(orgSlug: string) {
    return this.drizzle.db
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
      .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(
        and(eq(organizations.slug, orgSlug), isNull(orgMembers.removedAt)),
      );
  }

  async updateRole(orgSlug: string, memberId: string, dto: UpdateRoleDto) {
    if (dto.role === "developer") {
      await this.ensureNotLastAdmin(orgSlug, memberId);
    }

    const [updated] = await this.drizzle.db
      .update(orgMembers)
      .set({ role: dto.role })
      .where(eq(orgMembers.id, memberId))
      .returning();

    if (!updated) throw new NotFoundException("Member not found");

    return updated;
  }

  private async ensureNotLastAdmin(orgSlug: string, memberId: string) {}
}
