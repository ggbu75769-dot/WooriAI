import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BudgetsController } from "./budgets.controller";
import { ChildrenController } from "./children.controller";
import { ConsentsController } from "./consents.controller";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingStoreService } from "./onboarding-store.service";

@Module({
  imports: [AuthModule],
  controllers: [BudgetsController, ChildrenController, ConsentsController, OnboardingController],
  providers: [OnboardingStoreService],
  exports: [OnboardingStoreService]
})
export class OnboardingModule {}
