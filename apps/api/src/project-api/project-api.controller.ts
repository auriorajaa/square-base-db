import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ProjectKeyGuard, ProjectKeyPayload } from "./project-key.guard.js";
import { ProjectApiService } from "./project-api.service.js";
import type { Request } from "express";
import { PROJECT_KEY_ROLES } from "@square-base-db/constants";

@Controller("projects/:projectSlug/rest")
@UseGuards(ProjectKeyGuard)
export class ProjectApiController {
  constructor(private projectApiService: ProjectApiService) {}

  private getProjectKey(req: Request): ProjectKeyPayload {
    // @ts-ignore
    return req["projectKey"] as ProjectKeyPayload;
  }

  private assertWriteAccess(req: Request): void {
    const { role } = this.getProjectKey(req);

    if (role !== PROJECT_KEY_ROLES.SERVICE_ROLE) {
      throw new ForbiddenException(
        "Write access is only allowed with a service role key",
      );
    }
  }

  @Get(":table")
  getRows(
    @Req() req: Request,
    @Param("projectSlug") projectSlug: string,
    @Param("table") table: string,
    @Query() query: Record<string, string>,
  ) {
    const { projectId } = this.getProjectKey(req);

    return this.projectApiService.getRows(projectId, projectSlug, table, query);
  }

  @Post(":table")
  insertRow(
    @Req() req: Request,
    @Param("projectSlug") projectSlug: string,
    @Param("table") table: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertWriteAccess(req);
    const { projectId } = this.getProjectKey(req);

    return this.projectApiService.insertRow(
      projectId,
      projectSlug,
      table,
      body,
    );
  }

  @Patch(":table/:id")
  updateRow(
    @Req() req: Request,
    @Param("projectSlug") projectSlug: string,
    @Param("table") table: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertWriteAccess(req);
    const { projectId } = this.getProjectKey(req);

    return this.projectApiService.updateRow(
      projectId,
      projectSlug,
      table,
      id,
      body,
    );
  }

  @Delete(":table/:id")
  deleteRow(
    @Req() req: Request,
    @Param("projectSlug") projectSlug: string,
    @Param("table") table: string,
    @Param("id") id: string,
  ) {
    this.assertWriteAccess(req);
    const { projectId } = this.getProjectKey(req);

    return this.projectApiService.deleteRow(projectId, projectSlug, table, id);
  }
}
