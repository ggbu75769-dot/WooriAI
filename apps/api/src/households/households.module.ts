import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../common/audit/audit.module";
import { CustomCategoriesController } from "./custom-categories.controller";
import { CustomCategoriesService } from "./custom-categories.service";
import { HouseholdRuntimeModule } from "./household-runtime.module";
import { HouseholdsController } from "./households.controller";
import { InviteLandingController } from "./invite-landing.controller";

// 라운드 103 T1: 커스텀 지출 분류 쓰기(생성·이름변경·보관/복원)가 이 모듈에 붙는다 —
// URL이 `households/:householdId/categories`이고 권한도 가구 역할(HouseholdRoleGuard)이라
// 가구 모듈이 자연스러운 자리다(읽기는 종전대로 FinanceModule의 GET /categories 하나).
// PrismaService는 PrismaModule이 @Global이라 imports에 다시 적지 않는다.
@Module({
  imports: [AuthModule, AuditModule, HouseholdRuntimeModule],
  controllers: [HouseholdsController, InviteLandingController, CustomCategoriesController],
  providers: [CustomCategoriesService]
})
export class HouseholdsModule {}
