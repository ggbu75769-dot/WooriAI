import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../common/audit/audit.module";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { ImportsController } from "./imports.controller";

// GAP-064 #9: 확정(승인)을 감사 로그에 남기므로 AuditModule을 함께 import한다
// (finance/onboarding/settings/households 모듈과 같은 관례 — AuditModule은 전역이 아니다).
@Module({
  imports: [AuthModule, AuditModule, OnboardingModule],
  controllers: [ImportsController]
})
export class ImportsModule {}
