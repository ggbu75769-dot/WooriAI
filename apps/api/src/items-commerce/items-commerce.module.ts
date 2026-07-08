import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { CommerceController } from "./commerce.controller";
import { ItemsController } from "./items.controller";

@Module({
  imports: [AuthModule, OnboardingModule],
  controllers: [CommerceController, ItemsController]
})
export class ItemsCommerceModule {}
