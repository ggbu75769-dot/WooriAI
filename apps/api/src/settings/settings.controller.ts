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
    return await this.households.leaveHousehold(request.user!, householdId);
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
    return result;
  }
}
