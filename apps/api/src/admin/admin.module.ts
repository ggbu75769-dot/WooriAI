import { Module } from "@nestjs/common";
import { AuditModule } from "../common/audit/audit.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { AdminController } from "./admin.controller";
import { AdminMfaService } from "./admin-mfa.service";
import { AdminJobsController } from "./admin-jobs.controller";
import { AdminOperationsController } from "./admin-operations.controller";
import { PrivacyModule } from "../privacy/privacy.module";
import { AdminSessionService } from "./admin-session.service";
import { AdminTokenGuard } from "./admin-token.guard";
import { ContentRevisionsController } from "./content-revisions.controller";
import { ContentRevisionsService } from "./content-revisions.service";
import { ObjectStorageModule } from "../common/storage/object-storage.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [OnboardingModule, AuditModule, PrivacyModule, ObjectStorageModule, NotificationsModule],
  controllers: [AdminController, AdminAuthController, AdminJobsController, AdminOperationsController, ContentRevisionsController],
  providers: [AdminTokenGuard, AdminAuthGuard, AdminAuthService, AdminSessionService, AdminMfaService, ContentRevisionsService],
  exports: [AdminAuthGuard, AdminSessionService, AdminTokenGuard, ContentRevisionsService]
})
export class AdminModule {}
