import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../common/audit/audit.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { ChildExpensesController, ExpensesController, ExpenseShortcutsController } from "./expenses.controller";
import { ExpensesVersionService } from "./expenses.service";
import { HomeController } from "./home.controller";
import { PaymentMethodsController } from "./payment-methods.controller";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [AuditModule, AuthModule, OnboardingModule],
  controllers: [ChildExpensesController, ExpensesController, ExpenseShortcutsController, HomeController, ReportsController, PaymentMethodsController],
  providers: [ExpensesVersionService],
  exports: [ExpensesVersionService]
})
export class FinanceModule {}
