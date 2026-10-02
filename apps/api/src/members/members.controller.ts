import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { OrgRoleGuard } from "../auth/guards/org-role.guard.js";
import { MembersService } from "./members.service.js";
import { InviteService } from "./invite.service.js";
import { RequireOrgRole } from "../auth/decorators/require-org-role.decorator.js";
import { UpdateRoleDto } from "./dto/update-role.dto.js";
import { InviteMemberDto } from "./dto/invite-member.dto.js";

@Controller("orgs/:slug/members")
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class MembersController {
  constructor(
    private membersService: MembersService,
    private inviteService: InviteService,
  ) {}

  // Get all members of an organization by orgSlug
  @Get()
  getMembers(@Param("slug") slug: string) {
    return this.membersService.getMembers(slug);
  }

  // Update the role of a member in an organization
  // Only admins can update the role of a member
  @Patch(":memberId/role")
  @RequireOrgRole("admin")
  updateRole(
    @Param("slug") slug: string,
    @Param("memberId") memberId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.membersService.updateRole(slug, memberId, dto);
  }

  // Remove a member from an organization
  // Only admins can remove a member from an organization
  @Delete(":memberId")
  @RequireOrgRole("admin")
  removeMember(
    @Param("slug") slug: string,
    @Param("memberId") memberId: string,
  ) {
    return this.membersService.removeMember(slug, memberId);
  }

  // Send an invitation to a user to join an organization
  // Only admins can send invites to users
  @Post("invite")
  @RequireOrgRole("admin")
  sendInvite(@Param("slug") slug: string, @Body() dto: InviteMemberDto) {
    return this.inviteService.sendInvite(slug, dto.email);
  }
}
