import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { OrgRoleGuard } from "../auth/guards/org-role.guard.js";
import { ProjectsService } from "./projects.service.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { JwtPayload } from "@square-base-db/types";
import { RequireOrgRole } from "../auth/decorators/require-org-role.decorator.js";
import { CreateProjectDto } from "./dto/create-project.dto.js";

@Controller("orgs/:slug/projects")
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  // Get all projects for a given organization slug and user ID
  // This endpoint is protected by JWT authentication and organization role guard
  @Get()
  getProjects(@Param("slug") slug: string, @CurrentUser() user: JwtPayload) {
    return this.projectsService.getProjectForOrg(slug, user.sub);
  }

  // Get a specific project by its slug for a given organization slug and user ID
  // This endpoint is protected by JWT authentication and organization role guard
  // The projectSlug parameter is used to identify the project within the organization
  // The user must be a member of the organization to see its projects
  @Get(":projectSlug")
  getProject(
    @Param("slug") slug: string,
    @Param("projectSlug") projectSlug: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.getProjectBySlug(slug, projectSlug, user.sub);
  }

  // Create a new project for a given organization slug
  // This endpoint is protected by JWT authentication and organization role guard
  // Only users with the "admin" role in the organization can create new projects
  @Post()
  @RequireOrgRole("admin")
  createProject(@Param("slug") slug: string, @Body() dto: CreateProjectDto) {
    return this.projectsService.createProject(slug, dto);
  }
}
