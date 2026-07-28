import "reflect-metadata";
import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AppConfigModule } from "./app-config/app-config.module";
import { AuthModule } from "./auth/auth.module";
import { CatalogV2Module } from "./catalog-v2/catalog-v2.module";
import { AuditModule } from "./common/audit/audit.module";
import { FinanceModule } from "./finance/finance.module";
import { HealthModule } from "./health/health.module";
import { HouseholdsModule } from "./households/households.module";
import { ImportsModule } from "./imports/imports.module";
import { ItemsCommerceModule } from "./items-commerce/items-commerce.module";
import { JobsModule } from "./jobs/jobs.module";
import { LegalModule } from "./legal/legal.module";
import { MetricsModule } from "./metrics/metrics.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PrivacyModule } from "./privacy/privacy.module";
import { PresetsModule } from "./presets/presets.module";
import { SettingsModule } from "./settings/settings.module";
import { SyncModule } from "./sync/sync.module";
import { TrustModule } from "./trust/trust.module";
import { Release5Module } from "./release5/release5.module";
import { ServiceHeartbeatService } from "./common/operations/service-heartbeat.service";

@Module({
  imports: [
    PrismaModule,
    AdminModule,
    AnalyticsModule,
    AppConfigModule,
    AuditModule,
    AuthModule,
    CatalogV2Module,
    FinanceModule,
    HealthModule,
    HouseholdsModule,
    ImportsModule,
    ItemsCommerceModule,
    JobsModule,
    LegalModule,
    MetricsModule,
    NotificationsModule,
    OnboardingModule,
    PrivacyModule,
    PresetsModule,
    SettingsModule,
    SyncModule,
    TrustModule,
    Release5Module
  ],
  providers: [ServiceHeartbeatService]
})
export class AppModule {}
