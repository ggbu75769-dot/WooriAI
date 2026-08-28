import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreateExpenseDto, UpdateExpenseDto } from "./dto/expense.dto";
import { ExpenseDeleteQueryDto, ListExpensesQueryDto } from "./dto/query.dto";
import { ExpensesVersionService } from "./expenses.service";

@Controller("children/:childId/expenses")
@UseGuards(JwtAuthGuard)
export class ChildExpensesController {
  constructor(@Inject(ExpensesVersionService) private readonly expenses: ExpensesVersionService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(ListExpensesQueryDto)) query: ListExpensesQueryDto
  ) {
    return await this.expenses.listExpenses(request.user!, childId, query);
  }

  @Post()
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Body(createDtoValidationPipe(CreateExpenseDto)) body: CreateExpenseDto
  ) {
    return await this.expenses.createExpense(request.user!, childId, body);
  }
}

@Controller("expenses")
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(
    @Inject(ExpensesVersionService) private readonly expenses: ExpensesVersionService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

  @Get(":expenseId")
  async get(@Req() request: AuthenticatedRequest, @Param("expenseId") expenseId: string) {
    return await this.expenses.getExpense(request.user!, expenseId);
  }

  /**
   * CS-101(라운드 56 트랙 C): 수정도 삭제(expense.delete)와 같은 형식으로 감사 로그에
   * 남긴다. 종전에는 삭제만 기록돼 "금액이 혼자 바뀌었어요" 문의가 오면 어드민 감사
   * 로그에서 확인할 근거가 아예 없었다(누가·언제·무엇을 무엇으로).
   * before/after는 삭제와 동일한 지출 스냅샷이고, 자격증명류 키가 없다 —
   * 조회 API(admin/audit-logs.service.ts)가 한 번 더 마스킹하는 관례도 그대로 탄다.
   * 기록 실패는 AuditLoggerService가 삼키므로 수정 응답에는 영향이 없고,
   * 멱등 재전송은 인터셉터가 캐시 응답으로 끊어 중복 기록되지 않는다.
   *
   * ## 개인정보 영향 판단 (라운드 57 QA P2-14 — 코드 변경 없음, 판단만 기록)
   *
   * **이 기록은 새 노출면을 열지 않는다.** 근거 셋이 전부다.
   *  1. **스냅샷이 같다.** `before`/`after`는 바로 아래 `expense.delete`가 이미 남기고 있는 것과
   *     **같은 지출 스냅샷**이다(`ExpensesVersionService`가 두 경로에 같은 모양을 만든다) — 필드가
   *     하나도 늘지 않았고, 자격증명·토큰류 키는 애초에 그 모양에 없다.
   *  2. **마스킹을 그대로 통과한다.** 조회 API(`admin/audit-logs.service.ts`)가 봉투를 한 번 더
   *     마스킹하는데, 그 규칙은 action이 아니라 **키 이름**으로 돈다. 새 action 하나가 그 규칙을
   *     비켜 가는 경로를 만들지 않는다.
   *  3. **볼 수 있는 사람이 같다.** 감사 로그 열람은 admin RBAC 뒤에 있고 가구·행위자 스코프도
   *     delete와 동일하다(`householdId`·`actorUserId`). 즉 늘어난 것은 **같은 종류의 행 수**뿐이고,
   *     보관·파기도 기존 audit_logs 정책을 그대로 탄다.
   *
   * 바꿔 말하면 이 라운드에서 늘어난 것은 "지출이 어떻게 바뀌었는가"라는 **사실의 기록**이지
   * 새로운 개인정보 항목이 아니다. 그리고 그 기록이 없을 때의 비용은 실제로 관측됐다 —
   * "금액이 혼자 바뀌었어요" 문의에 답할 근거가 아예 없었다.
   */
  @Patch(":expenseId")
  @UseInterceptors(IdempotencyInterceptor)
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("expenseId") expenseId: string,
    @Body(createDtoValidationPipe(UpdateExpenseDto)) body: UpdateExpenseDto
  ) {
    const result = await this.expenses.updateExpense(request.user!, expenseId, body);
    await this.auditLogger.record({
      actorUserId: request.user!.id,
      householdId: result.householdId,
      action: "expense.update",
      targetType: "expense",
      targetId: expenseId,
      before: result.before,
      after: result.after
    });
    return result.expense;
  }

  @Delete(":expenseId")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(
    @Req() request: AuthenticatedRequest,
    @Param("expenseId") expenseId: string,
    @Query(createDtoValidationPipe(ExpenseDeleteQueryDto)) query: ExpenseDeleteQueryDto
  ) {
    const result = await this.expenses.deleteExpense(request.user!, expenseId, query.expectedVersion);
    await this.auditLogger.record({
      actorUserId: request.user!.id,
      householdId: result.householdId,
      action: "expense.delete",
      targetType: "expense",
      targetId: expenseId,
      before: result.before,
      after: result.after
    });
    return { success: true };
  }
}
