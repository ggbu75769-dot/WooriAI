import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../common/audit/audit.module";
import { HouseholdRuntimeModule } from "./household-runtime.module";
import { HouseholdsController } from "./households.controller";
import { InviteLandingController } from "./invite-landing.controller";

@Module({
  imports: [AuthModule, AuditModule, HouseholdRuntimeModule],
  controllers: [HouseholdsController, InviteLandingController]
})
export class HouseholdsModule {}
