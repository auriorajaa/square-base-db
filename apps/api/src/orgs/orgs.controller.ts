import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { OrgsService } from "./orgs.service.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { JwtPayload } from "@square-base-db/types";
import { CreateOrgDto } from "./dto/create-org.dto.js";

@Controller("orgs")
@UseGuards(JwtAuthGuard)
export class OrgsController {
  constructor(private orgsService: OrgsService) {}

  // Get all organizations for the current authenticated user
  @Get()
  getMyOrgs(@CurrentUser() user: JwtPayload) {
    return this.orgsService.getMyOrgs(user.sub);
  }

  // Get a specific organization by its slug for the current authenticated user
  // The slug is a unique identifier for the organization, typically derived from its name.
  @Get(":slug")
  getOrgBySlug(@Param("slug") slug: string, @CurrentUser() user: JwtPayload) {
    return this.orgsService.getOrgBySlug(slug, user.sub);
  }

  // Create a new organization for the current authenticated user
  @Post()
  createOrg(@Body() dto: CreateOrgDto, @CurrentUser() user: JwtPayload) {
    return this.orgsService.createOrg(dto, user.sub);
  }
}
