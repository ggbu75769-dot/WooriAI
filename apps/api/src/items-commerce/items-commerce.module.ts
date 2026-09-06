import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { CommerceController } from "./commerce.controller";
import { CustomItemsController } from "./custom-items.controller";
import { ItemsController } from "./items.controller";
import { AffiliateRedirectController } from "./redirect.controller";

@Module({
  imports: [AuthModule, OnboardingModule],
  // 라운드 100 T1: CustomItemsController(생성/수정/삭제)만 추가 — 읽기(목록 합류·상세·status
  // 다형화)는 기존 ItemsController 경로에 가산으로 얹힌다(round100 설계 §2.1).
  controllers: [CommerceController, CustomItemsController, ItemsController, AffiliateRedirectController]
})
export class ItemsCommerceModule {}
