import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { CommerceController } from "./commerce.controller";
import { ItemsController } from "./items.controller";
import { AffiliateRedirectController } from "./redirect.controller";

@Module({
  imports: [AuthModule, OnboardingModule],
  controllers: [CommerceController, ItemsController, AffiliateRedirectController]
})
export class ItemsCommerceModule {}
