import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BudgetsController } from "./budgets.controller";
import { ChildrenController } from "./children.controller";
import { ConsentsController } from "./consents.controller";
import { OnboardingController } from "./onboarding.controller";
import { ChildAccessService } from "./child-access.service";
import { ExpensesStoreService } from "./expenses-store.service";
import { ImportPipelineService } from "./import-pipeline.service";
import { ItemsCatalogService } from "./items-catalog.service";
import { OnboardingCoreService } from "./onboarding-core.service";
import { ReportingStoreService } from "./reporting-store.service";

/**
 * REF-118: the former OnboardingStoreService god service (1,957 lines) is
 * decomposed into the cohesive services below. This module keeps providing and
 * exporting all of them so dependent modules (finance, imports, items-commerce,
 * admin, settings) keep importing OnboardingModule exactly as before — the
 * module dependency graph is unchanged.
 */
@Module({
  imports: [AuthModule],
  controllers: [BudgetsController, ChildrenController, ConsentsController, OnboardingController],
  providers: [
    ChildAccessService,
    ExpensesStoreService,
    OnboardingCoreService,
    ItemsCatalogService,
    ImportPipelineService,
    ReportingStoreService
  ],
  exports: [
    ChildAccessService,
    ExpensesStoreService,
    OnboardingCoreService,
    ItemsCatalogService,
    ImportPipelineService,
    ReportingStoreService
  ]
})
export class OnboardingModule {}
