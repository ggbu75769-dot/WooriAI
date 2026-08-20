import "reflect-metadata";
import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./common/audit/audit.module";
import { DevicesModule } from "./devices/devices.module";
import { FinanceModule } from "./finance/finance.module";
import { HealthModule } from "./health/health.module";
import { HouseholdsModule } from "./households/households.module";
import { ImportsModule } from "./imports/imports.module";
import { ItemsCommerceModule } from "./items-commerce/items-commerce.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SettingsModule } from "./settings/settings.module";
import { SyncModule } from "./sync/sync.module";
import { WorkerModule } from "./worker/worker.module";

@Module({
  imports: [
    PrismaModule,
    AdminModule,
    AnalyticsModule,
    AuditModule,
    AuthModule,
    DevicesModule,
    FinanceModule,
    HealthModule,
    HouseholdsModule,
    ImportsModule,
    ItemsCommerceModule,
    OnboardingModule,
    SettingsModule,
    SyncModule,
    WorkerModule
  ]
})
export class AppModule {}
