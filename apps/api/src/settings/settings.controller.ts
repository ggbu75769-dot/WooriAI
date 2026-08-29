import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { RefreshTokenStore } from "../auth/refresh-token.store";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest, AuthenticatedUser } from "../common/types/authenticated-request";
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

/**
 * GAP-070 D: 관리자가 가구를 떠날 때만 서는 한 줄.
 *
 * 사실 근거 — 권한 판정은 **구성원 역할**을 본다(household-runtime.service.ts의 assertOwner).
 * leaveHousehold/withdrawUser는 구성원 행을 `left`로 바꾸므로, 관리자가 나간 뒤 그 가구에는
 * `owner` 역할을 가진 사람이 아무도 없다(households.ownerUserId 컬럼은 남지만 판정에 쓰이지
 * 않는다). 그리고 관리자만 할 수 있는 일이 셋이다 — 초대 생성(createInvite)·초대 취소
 * (cancelInvite)·구성원 삭제(removeMember). **역할을 바꾸거나 넘기는 엔드포인트는 저장소에
 * 0건**이라 그 상태는 되돌릴 수 없다.
 *
 * 그래서 이 줄은 겁주지 않고 결과만 적는다 — **막지 않는다, 말한다.** 탈퇴·삭제를 막으면
 * 마지막 관리자가 자기 계정에 갇히고, 계정 삭제 경로로 어차피 같은 결과가 난다.
 * "소유권을 넘기는 경로가 없다"는 사실 자체는 docs/operations/known-limitations.md의 몫이다.
 *
 * 두 흐름이 같은 한 문장을 쓰는 이유: 탈퇴는 그 가구, 계정 삭제는 관리자로 있는 모든 가구가
 * 대상이라 주어를 "그 가족"으로 두면 양쪽 다 참이다(계정 삭제는 바로 윗줄이 이미 "참여 중인
 * 가구에서 모두 나가게 돼요"라고 말한다).
 *
 * 데모 세션 거울은 apps/mobile/src/api/local-backend.ts의 LAST_OWNER_LEAVE_IMPACT_LINE —
 * 라운드 46이 세운 "impact 서버-데모 통일" 규율대로 **글자까지 같아야 한다**.
 */
const LAST_OWNER_LEAVE_IMPACT_LINE =
  "관리자인 내가 나가면 그 가족에 관리자가 없어져서 새 구성원 초대와 구성원 관리를 아무도 할 수 없어요";

/**
 * 이 판정은 **새 조회를 하지 않는다** — 역할은 `AuthenticatedUser.households`에 이미 실려
 * 있고(enrichUser가 매 토큰 검증마다 DB에서 채운다), assertOwner가 읽는 것과 같은 값이다.
 * 남은 구성원 수는 세지 않는다: 그 숫자는 조회가 하나 더 필요하고, "혼자 쓰는 가구"에서도
 * 위 문장이 거짓이 되지는 않는다.
 */
function isHouseholdOwner(user: AuthenticatedUser, householdId: string) {
  return user.households.some((household) => household.id === householdId && household.role === "owner");
}

function ownsAnyHousehold(user: AuthenticatedUser) {
  return user.households.some((household) => household.role === "owner");
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
  householdLeavePreview(@Req() request: AuthenticatedRequest, @Param("householdId") householdId: string) {
    return {
      flowId: "household_leave",
      householdId,
      requiresSecondStep: true,
      confirmationText: "LEAVE HOUSEHOLD",
      // 라운드 45 UX-AA: 이 배열은 앱의 "진행하면 이렇게 돼요" 상자에 **그대로** 그려진다
      // (apps/mobile/app/settings/privacy.tsx의 PreviewSummary). 영문 원문은 되돌릴 수 없는
      // 결정을 앞둔 화면에서 읽히지 않는 문장이었으므로, 앱의 다른 문구와 같은 해요체 사실
      // 서술로 적는다(DNC-018). 데모 세션 거울은 apps/mobile/src/api/local-backend.ts.
      //
      // GAP-070 D: 종전에는 역할을 보지 않는 정적 배열이라 **관리자가 나갈 때만 일어나는
      // 일**을 한 글자도 말하지 않았다. 이제 요청자의 역할에서 파생한다(아이 삭제 미리보기가
      // 이미 요청자 기준으로 만들어지는 그 형식). 비관리자에게는 종전과 바이트 단위로 같다.
      impact: isHouseholdOwner(request.user!, householdId)
        ? ["이 가구에 공유된 아이 기록을 볼 수 없어요", LAST_OWNER_LEAVE_IMPACT_LINE]
        : ["이 가구에 공유된 아이 기록을 볼 수 없어요"]
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
  accountDeletePreview(@Req() request: AuthenticatedRequest) {
    return {
      flowId: "account_delete",
      requiresSecondStep: true,
      confirmationText: "DELETE ACCOUNT",
      // 라운드 45 UX-AA: 위 leave-preview와 같은 이유로 해요체 사실 서술. 두 줄은 실제 동작
      // 그대로다 -- withdrawUser(households/household-runtime.service.ts)가 사용자를
      // withdrawn으로 바꾸고(카카오 로그인은 USER_WITHDRAWN으로 거절된다) 활성/대기 가구
      // 구성원 행을 전부 left로 만든다.
      //
      // GAP-070 D: 이 핸들러는 종전에 `@Req()`조차 받지 않는 완전 정적 응답이었다. 그런데
      // 위 두 줄이 말하는 "모두 나가게 돼요"에는 **관리자로 있는 가구**가 섞여 있을 수 있고,
      // 그 가구는 그 순간 초대·구성원 관리를 영구히 잃는다. 관리자인 가구가 하나라도 있으면
      // 한 줄을 더한다 — 이 트랙의 유일한 시그니처 변경이다.
      impact: ownsAnyHousehold(request.user!)
        ? ["이 계정으로는 다시 로그인할 수 없어요", "참여 중인 가구에서 모두 나가게 돼요", LAST_OWNER_LEAVE_IMPACT_LINE]
        : ["이 계정으로는 다시 로그인할 수 없어요", "참여 중인 가구에서 모두 나가게 돼요"]
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
