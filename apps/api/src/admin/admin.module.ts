import { Module } from "@nestjs/common";
import { AuditModule } from "../common/audit/audit.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { AdminController } from "./admin.controller";
import { AdminMfaService } from "./admin-mfa.service";
import { AdminSessionService } from "./admin-session.service";
import { AdminTokenGuard } from "./admin-token.guard";
import { AdminUsersController } from "./admin-users.controller";
import { ContentRevisionsController } from "./content-revisions.controller";
import { ContentRevisionsService } from "./content-revisions.service";
import { ProductLinkBulkController } from "./product-link-bulk.controller";
import { ProductLinkBulkService } from "./product-link-bulk.service";

@Module({
  imports: [OnboardingModule, AuditModule],
  controllers: [AdminController, AdminAuthController, AdminUsersController, ContentRevisionsController, ProductLinkBulkController],
  providers: [
    AdminTokenGuard,
    AdminAuthGuard,
    AdminAuthService,
    AdminSessionService,
    AdminMfaService,
    ContentRevisionsService,
    ProductLinkBulkService
  ],
  // ContentRevisionsService is exported for WorkerModule (INF-006-lite): the
  // scheduled-publish job must reuse the exact manual approve-publish code path.
  exports: [AdminAuthGuard, ContentRevisionsService]
})
export class AdminModule {}
