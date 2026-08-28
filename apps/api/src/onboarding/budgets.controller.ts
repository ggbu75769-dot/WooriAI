import { Body, Controller, Get, Inject, Param, Put, Query, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { IsOptional, Matches } from "class-validator";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { YEAR_MONTH_INPUT_PATTERN } from "../common/validation/year-month";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { UpsertBudgetDto } from "./dto/upsert-budget.dto";
import { OnboardingCoreService } from "./onboarding-core.service";

class BudgetQueryDto {
  // REP-105: PUT과 동일하게 YYYY-MM / YYYY-MM-01 모두 허용 (서비스는 월 단위로 정규화).
  // 월은 01-12로 제한 — 공유 YEAR_MONTH_INPUT_PATTERN과 동일 (2026-13 등은 400).
  @IsOptional()
  @Matches(YEAR_MONTH_INPUT_PATTERN)
  yearMonth?: string;
}

@Controller("children/:childId/budget")
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(
    @Inject(OnboardingCoreService) private readonly store: OnboardingCoreService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

  @Get()
  async get(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(BudgetQueryDto)) query: BudgetQueryDto
  ) {
    return await this.store.getBudget(request.user!, childId, query.yearMonth);
  }

  /**
   * GAP-063 #5: 예산 덮어쓰기를 감사 로그에 남긴다.
   *
   * 종전에는 앱의 **돈 관련 쓰기 중 유일하게** 흔적이 0이었다. 지출은 수정·삭제 둘 다
   * before/after 스냅샷을 남기고(CS-101 — expenses.controller.ts), 라운드 62 #7이
   * 가구 탈퇴·계정 삭제까지 채웠는데, 예산만 남아 있었다. 그런데 `budgets` 행은
   * `(child_id, year_month)` 유니크 한 칸이라 덮어쓰면 이전 금액이 어디에도 남지 않고,
   * 부부 공동 가구에서는 양쪽 모두 이 경로에 쓰기 권한이 있다 — "왜 갑자기 예산 경고가
   * 뜨죠"라는 문의에 "누가·언제·얼마에서 얼마로"를 답할 근거가 서버에 없었다.
   * 예산은 홈 히어로·경고 배너·푸시 경계 판정을 한꺼번에 움직이는 값이라 비용이 크다.
   *
   * 봉투는 expense.update와 같은 모양이고, 그 이상은 싣지 않는다: 금액·연월·childId뿐
   * (PII 금지 — 기존 마스킹 관례를 그대로 탄다). before가 null이면 첫 설정이라는 뜻이다.
   * 기록 실패는 AuditLoggerService가 삼키므로 저장 응답에는 영향이 없고, 멱등 재전송은
   * 위 IdempotencyInterceptor가 캐시 응답으로 끊어 중복 기록되지 않는다.
   * 볼륨은 지출보다 훨씬 낮다(월 1~2회) — 감사 보존 창(기본 730일)을 그대로 타는
   * additive 경로이고, 마이그레이션은 0건이다.
   */
  @Put()
  @UseInterceptors(IdempotencyInterceptor)
  async upsert(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Body(createDtoValidationPipe(UpsertBudgetDto)) body: UpsertBudgetDto
  ) {
    const result = await this.store.upsertBudget(request.user!, childId, body.yearMonth, body.amountKrw);
    await this.auditLogger.record({
      actorUserId: request.user!.id,
      householdId: result.householdId,
      action: "budget.upsert",
      targetType: "budget",
      targetId: result.budgetId,
      before: result.before,
      after: result.after
    });
    return result.budget;
  }
}
