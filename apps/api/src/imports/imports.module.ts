import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { ImportsController } from "./imports.controller";

@Module({
  imports: [AuthModule, OnboardingModule],
  controllers: [ImportsController]
})
export class ImportsModule {}
