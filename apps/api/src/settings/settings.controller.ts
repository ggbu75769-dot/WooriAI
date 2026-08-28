import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { RefreshTokenStore } from "../auth/refresh-token.store";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { HouseholdRuntimeService } from "../households/household-runtime.service";
import { OnboardingCoreService } from "../onboarding/onboarding-core.service";
import { SettingsConfirmationDto } from "./dto/settings.dto";

function assertConfirmation(actual: string, expected: string) {
  if (actual !== expected) {
    throw new BadRequestException({
      code: "SETTINGS_CONFIRMATION_REQUIRED",
      message: "Confirmation text does not match."
    });
  }
}

@Controller("settings")
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(
    @Inject(OnboardingCoreService) private readonly store: OnboardingCoreService,
    @Inject(HouseholdRuntimeService) private readonly households: HouseholdRuntimeService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService,
    @Inject(RefreshTokenStore) private readonly refreshTokenStore: RefreshTokenStore
  ) {}

  @Get("privacy")
  async privacy(@Req() request: AuthenticatedRequest) {
    return await this.store.getPrivacySettings(request.user!);
  }

  @Post("children/:childId/delete-preview")
  @HttpCode(200)
  async childDeletePreview(@Req() request: AuthenticatedRequest, @Param("childId") childId: string) {
    return await this.store.previewChildProfileDeletion(request.user!, childId);
  }

  @Post("children/:childId/delete-confirm")
  @HttpCode(200)
  async childDeleteConfirm(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Body(createDtoValidationPipe(SettingsConfirmationDto)) body: SettingsConfirmationDto
  ) {
    const result = await this.store.confirmChildProfileDeletion(request.user!, childId, body.confirmationText);
    await this.auditLogger.record({
      actorUserId: request.user!.id,
      householdId: result.householdId,
      action: "child_profile.delete",
      targetType: "child_profile",
      targetId: childId,
      after: { deletedExpenseCount: result.deletedExpenseCount, deletedAt: result.deletedAt }
    });
    return { success: result.success, flowId: result.flowId };
  }

  @Post("households/:householdId/leave-preview")
  @HttpCode(200)
  householdLeavePreview(@Param("householdId") householdId: string) {
    return {
      flowId: "household_leave",
      householdId,
      requiresSecondStep: true,
      confirmationText: "LEAVE HOUSEHOLD",
      // 라운드 45 UX-AA: 이 배열은 앱의 "진행하면 이렇게 돼요" 상자에 **그대로** 그려진다
      // (apps/mobile/app/settings/privacy.tsx의 PreviewSummary). 영문 원문은 되돌릴 수 없는
      // 결정을 앞둔 화면에서 읽히지 않는 문장이었으므로, 앱의 다른 문구와 같은 해요체 사실
      // 서술로 적는다(DNC-018). 데모 세션 거울은 apps/mobile/src/api/local-backend.ts.
      impact: ["이 가구에 공유된 아이 기록을 볼 수 없어요"]
    };
  }

  @Post("households/:householdId/leave-confirm")
  @HttpCode(200)
  async householdLeaveConfirm(
    @Req() request: AuthenticatedRequest,
    @Param("householdId") householdId: string,
    @Body(createDtoValidationPipe(SettingsConfirmationDto)) body: SettingsConfirmationDto
  ) {
    assertConfirmation(body.confirmationText, "LEAVE HOUSEHOLD");
    const result = await this.households.leaveHousehold(request.user!, householdId);
    // GAP-062 #7: 스스로 나간 사실도 남긴다. 종전에는 **남이 나를 내보낸 것**만
    // 기록됐고(households.controller.ts의 household.member.remove), 자발적 탈퇴는
    // 구성원 행이 `left`로 바뀐 흔적만 남아 누가·언제·어느 경로로 나갔는지
    // ("가구에서 나간 적 없는데 기록이 안 보여요" CS)에 답할 근거가 0이었다.
    //
    // 봉투는 child_profile.delete와 같은 모양이고, 그 이상은 싣지 않는다:
    //  - 시각은 행의 created_at, 행위자는 actor_user_id, 대상 가구는 household_id
    //    /target_id가 이미 말한다 — 컨트롤러에서 지어낸 값을 덧붙이지 않는다.
    //  - PII(닉네임·이메일)는 금지(기존 마스킹 관례).
    // 파기 정합: 이 행의 actor_user_id는 파기 잡 phase 3이 탈퇴 시 null로 만들고
    // (data-retention-purge.job.ts의 auditLog.updateMany), 행 자체는 감사 보존
    // 창(기본 730일) 안에서 익명화된 운영 기록으로 남는다.
    await this.auditLogger.record({
      actorUserId: request.user!.id,
      householdId,
      action: "household.leave",
      targetType: "household",
      targetId: householdId,
      after: { flowId: result.flowId }
    });
    return result;
  }

  @Post("account/delete-preview")
  @HttpCode(200)
  accountDeletePreview() {
    return {
      flowId: "account_delete",
      requiresSecondStep: true,
      confirmationText: "DELETE ACCOUNT",
      // 라운드 45 UX-AA: 위 leave-preview와 같은 이유로 해요체 사실 서술. 두 줄은 실제 동작
      // 그대로다 -- withdrawUser(households/household-runtime.service.ts)가 사용자를
      // withdrawn으로 바꾸고(카카오 로그인은 USER_WITHDRAWN으로 거절된다) 활성/대기 가구
      // 구성원 행을 전부 left로 만든다.
      impact: ["이 계정으로는 다시 로그인할 수 없어요", "참여 중인 가구에서 모두 나가게 돼요"]
    };
  }

  @Post("account/delete-confirm")
  @HttpCode(200)
  async accountDeleteConfirm(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(SettingsConfirmationDto)) body: SettingsConfirmationDto
  ) {
    assertConfirmation(body.confirmationText, "DELETE ACCOUNT");
    const result = await this.households.withdrawUser(request.user!);
    await this.refreshTokenStore.revokeAllForUser(request.user!.id);
    // GAP-062 #7: 계정 삭제는 기록이 없으면 **사실 자체가 사라지는** 유일한 흐름이다 —
    // 파기 잡이 유예 기간 뒤 users 행을 물리 삭제하면(PURGE_RETENTION_DAYS) 그 계정이
    // 존재했다는 흔적이 어디에도 남지 않는다. 이 행 하나가 감사 보존 창(기본 730일)
    // 안에서 "누가 언제 스스로 탈퇴했다"를 말한다.
    //
    // householdId를 싣지 않는 이유: 탈퇴는 참여 중인 **모든** 가구에서 나가는
    // 흐름이라(withdrawUser) 그중 하나를 골라 적으면 사실이 아니게 된다.
    // targetId를 싣지 않는 이유: 대상이 곧 행위자인데, 파기 잡 phase 3은
    // actor_user_id만 null로 만든다 — 같은 uuid를 target_id에 복사해 두면 그
    // 익명화가 무력화된다(파기 뒤에도 이 행에 사용자 식별자가 남는다).
    await this.auditLogger.record({
      actorUserId: request.user!.id,
      action: "account.delete",
      targetType: "user",
      after: { flowId: result.flowId }
    });
    return result;
  }
}
