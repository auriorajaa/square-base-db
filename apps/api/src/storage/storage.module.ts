import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { StorageService } from "./storage.service.js";
import { StorageController } from "./storage.controller.js";
import { ProjectStorageController } from "./project-storage.controller.js";
import { JwtModule } from "@nestjs/jwt";
import { ProjectKeyGuard } from "../project-api/project-key.guard.js";

@Module({
  imports: [AuthModule, JwtModule.register({})],
  providers: [StorageService, ProjectKeyGuard],
  controllers: [StorageController, ProjectStorageController],
})
export class StorageModule {}
