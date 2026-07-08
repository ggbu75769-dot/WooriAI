import "reflect-metadata";
import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./common/audit/audit.module";
import { FinanceModule } from "./finance/finance.module";
import { HealthModule } from "./health/health.module";
import { HouseholdsModule } from "./households/households.module";
import { ImportsModule } from "./imports/imports.module";
import { ItemsCommerceModule } from "./items-commerce/items-commerce.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { SettingsModule } from "./settings/settings.module";

@Module({
  imports: [
    AdminModule,
    AuditModule,
    AuthModule,
    FinanceModule,
    HealthModule,
    HouseholdsModule,
    ImportsModule,
    ItemsCommerceModule,
    OnboardingModule,
    SettingsModule
  ]
})
export class AppModule {}
