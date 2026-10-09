import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { SqlEditorService } from "./sql-editor.service.js";
import { OrgRoleGuard } from "../auth/guards/org-role.guard.js";
import { SqlEditorController } from "./sql-editor.controller.js";

@Module({
  imports: [AuthModule],
  providers: [SqlEditorService, OrgRoleGuard],
  controllers: [SqlEditorController],
})
export class SqlEditorModule {}
