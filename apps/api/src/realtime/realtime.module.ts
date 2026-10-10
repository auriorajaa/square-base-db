import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { RealtimeGateway } from "./realtime.gateway.js";
import { RealtimeService } from "./realtime.service.js";
import { TriggerService } from "./trigger.service.js";
import { OrgRoleGuard } from "../auth/guards/org-role.guard.js";
import { RealtimeController } from "./realtime.controller.js";

@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, RealtimeService, TriggerService, OrgRoleGuard],
  controllers: [RealtimeController],
})
export class RealtimeModule {}
