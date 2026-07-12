import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../common/audit/audit.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { ChildExpensesController, ExpensesController } from "./expenses.controller";
import { ExpensesVersionService } from "./expenses.service";
import { HomeController } from "./home.controller";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [AuditModule, AuthModule, OnboardingModule],
  controllers: [ChildExpensesController, ExpensesController, HomeController, ReportsController],
  providers: [ExpensesVersionService],
  exports: [ExpensesVersionService]
})
export class FinanceModule {}
