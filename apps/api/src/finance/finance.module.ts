import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../common/audit/audit.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { ChildExpensesController, ExpensesController, ExpenseShortcutsController } from "./expenses.controller";
import { ExpensesVersionService } from "./expenses.service";
import { HomeController } from "./home.controller";
import { PaymentMethodsController } from "./payment-methods.controller";
import { ReportsController } from "./reports.controller";
import { ReportsV2Controller } from "./reports-v2.controller";
import { ReportsV2Service } from "./reports-v2.service";
import { Release5Module } from "../release5/release5.module";
import { AppConfigModule } from "../app-config/app-config.module";

@Module({
  imports: [AuditModule, AuthModule, OnboardingModule, Release5Module, AppConfigModule],
  controllers: [ChildExpensesController, ExpensesController, ExpenseShortcutsController, HomeController, ReportsController, ReportsV2Controller, PaymentMethodsController],
  providers: [ExpensesVersionService, ReportsV2Service],
  exports: [ExpensesVersionService, ReportsV2Service]
})
export class FinanceModule {}
