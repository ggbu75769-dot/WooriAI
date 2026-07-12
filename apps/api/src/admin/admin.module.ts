import { Module } from "@nestjs/common";
import { AuditModule } from "../common/audit/audit.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { AdminController } from "./admin.controller";
import { AdminTokenGuard } from "./admin-token.guard";

@Module({
  imports: [OnboardingModule, AuditModule],
  controllers: [AdminController, AdminAuthController],
  providers: [AdminTokenGuard, AdminAuthGuard, AdminAuthService],
  exports: [AdminAuthGuard]
})
export class AdminModule {}
