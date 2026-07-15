import "reflect-metadata";
import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AppConfigModule } from "./app-config/app-config.module";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./common/audit/audit.module";
import { FinanceModule } from "./finance/finance.module";
import { HealthModule } from "./health/health.module";
import { HouseholdsModule } from "./households/households.module";
import { ImportsModule } from "./imports/imports.module";
import { ItemsCommerceModule } from "./items-commerce/items-commerce.module";
import { JobsModule } from "./jobs/jobs.module";
import { LegalModule } from "./legal/legal.module";
import { MetricsModule } from "./metrics/metrics.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PrivacyModule } from "./privacy/privacy.module";
import { PresetsModule } from "./presets/presets.module";
import { SettingsModule } from "./settings/settings.module";
import { SyncModule } from "./sync/sync.module";
import { TrustModule } from "./trust/trust.module";

@Module({
  imports: [
    PrismaModule,
    AdminModule,
    AnalyticsModule,
    AppConfigModule,
    AuditModule,
    AuthModule,
    FinanceModule,
    HealthModule,
    HouseholdsModule,
    ImportsModule,
    ItemsCommerceModule,
    JobsModule,
    LegalModule,
    MetricsModule,
    OnboardingModule,
    PrivacyModule,
    PresetsModule,
    SettingsModule,
    SyncModule,
    TrustModule
  ]
})
export class AppModule {}
