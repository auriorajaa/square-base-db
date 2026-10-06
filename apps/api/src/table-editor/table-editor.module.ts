import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { TableEditorService } from "./table-editor.service.js";
import { OrgRoleGuard } from "../auth/guards/org-role.guard.js";
import { TableEditorController } from "./table-editor.controller.js";

@Module({
  imports: [AuthModule],
  providers: [TableEditorService, OrgRoleGuard],
  controllers: [TableEditorController],
})
export class TableEditorModule {}
