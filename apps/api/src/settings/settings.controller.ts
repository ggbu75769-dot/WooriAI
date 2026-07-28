import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { HouseholdRuntimeService } from "../households/household-runtime.service";
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
import { PrivacyService } from "../privacy/privacy.service";
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
    @Inject(OnboardingStoreService) private readonly store: OnboardingStoreService,
    @Inject(HouseholdRuntimeService) private readonly households: HouseholdRuntimeService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService,
    @Inject(PrivacyService) private readonly privacyService: PrivacyService
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
      impact: ["shared child data is no longer accessible from this account"]
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
      impact: ["요청 후 7일 동안 계정과 데이터가 유지됩니다", "유예 기간 안에는 언제든 삭제 요청을 취소할 수 있습니다", "7일이 지나면 로그인 접근이 중단되고 데이터 삭제가 시작됩니다"]
    };
  }

  @Post("account/delete-confirm")
  @HttpCode(200)
  async accountDeleteConfirm(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(SettingsConfirmationDto)) body: SettingsConfirmationDto
  ) {
    assertConfirmation(body.confirmationText, "DELETE ACCOUNT");
    const deletion = await this.privacyService.requestDeletion(request.user!);
    return { success: true, flowId: "account_delete", deletion };
  }
}
