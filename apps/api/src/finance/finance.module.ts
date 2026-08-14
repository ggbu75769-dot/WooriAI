import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../common/audit/audit.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { CategoriesController } from "./categories.controller";
import { ChildExpensesController, ExpensesController } from "./expenses.controller";
import { ExpensesVersionService } from "./expenses.service";
import { HomeController } from "./home.controller";
import { MilestoneReportService } from "./milestone-report.service";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [AuditModule, AuthModule, OnboardingModule],
  controllers: [CategoriesController, ChildExpensesController, ExpensesController, HomeController, ReportsController],
  providers: [ExpensesVersionService, MilestoneReportService],
  exports: [ExpensesVersionService]
})
export class FinanceModule {}
