import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { HouseholdRuntimeModule } from "../households/household-runtime.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [AuthModule, HouseholdRuntimeModule, OnboardingModule],
  controllers: [SettingsController]
})
export class SettingsModule {}
