import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { AuditModule } from "../common/audit/audit.module";
import { Release5AdminController } from "./release5-admin.controller";
import { Release5ReadinessService } from "./release5-readiness.service";
import { AuthModule } from "../auth/auth.module";
import { Release5DailyService } from "./release5-daily.service";
import { Release5UserController } from "./release5-user.controller";
import { AppConfigModule } from "../app-config/app-config.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { Release5AssistedService } from "./release5-assisted.service";
import { Release5ExternalService } from "./release5-external.service";
import { Release5ProviderController } from "./release5-provider.controller";

@Module({
  imports: [AdminModule, AuditModule, AuthModule, AppConfigModule, OnboardingModule],
  controllers: [Release5AdminController, Release5UserController, Release5ProviderController],
  providers: [Release5ReadinessService, Release5DailyService, Release5AssistedService, Release5ExternalService],
  exports: [Release5ReadinessService, Release5DailyService, Release5AssistedService, Release5ExternalService]
})
export class Release5Module {}
