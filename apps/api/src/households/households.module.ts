import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { HouseholdRuntimeModule } from "./household-runtime.module";
import { HouseholdsController } from "./households.controller";

@Module({
  imports: [AuthModule, HouseholdRuntimeModule],
  controllers: [HouseholdsController]
})
export class HouseholdsModule {}
