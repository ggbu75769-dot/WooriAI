import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../common/audit/audit.module";
import { HouseholdRuntimeModule } from "./household-runtime.module";
import { HouseholdsController } from "./households.controller";

@Module({
  imports: [AuthModule, AuditModule, HouseholdRuntimeModule],
  controllers: [HouseholdsController]
})
export class HouseholdsModule {}
