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
   * ## 개인정보 영향 판단 (라운드 57 QA P2-14 → **라운드 107 트랙 A에서 정정**)
   *
   * 라운드 57은 이 기록이 *"새 노출면을 열지 않는다"* 고 판단했고, 그 근거 ①은
   * *"before/after가 바로 아래 `expense.delete`가 이미 남기고 있는 것과 같은 지출 스냅샷"* 이었다.
   * **그 문장은 참이었지만 결론이 틀렸다** — 두 봉투가 *같다*는 사실은 두 봉투가 *안전하다*는
   * 뜻이 아니었고, 그 공통 모양(`toExpenseSnapshot`/`toExpenseDto`)이 사용자가 적은
   * **품목명·판매처·메모를 원문으로** 담고 있었다. 판단이 비교 대상을 잘못 골랐다: 대조했어야
   * 할 것은 옆 action이 아니라 **같은 저장소가 네 곳에서 세운 "감사 봉투에 자유 문자열 금지"**
   * 규율(custom-items · import-pipeline · kakao-auth · 예산 봉투)과,
   * `admin/admin-users-lookup.service.ts`가 **같은 admin 역할에게** *"지출 금액/품목/가맹점/메모
   * 일체"* 를 금지한 문장이었다.
   *
   * 그 사이 실제 비용: 감사 뷰어 CSV 한 장(최대 1,000행)에 지출 메모·품목명·판매처가 실려
   * 운영자 PC로 떨어졌고, 계정을 삭제해도 그 문자열이 730일 남았다(파기 잡 phase 3은
   * `actorUserId`만 null로 만든다).
   *
   * **지금**(정찰 S1-1): 봉투는 `toExpenseAuditSnapshot`으로만 뜬다 — 자유 문자열 세 축은
   * `after.changed`의 **축 이름으로만** 남고 값은 실리지 않으며, 기록자 연결값
   * (`createdByUserId`)도 함께 뺐다. 라운드 57의 근거 ②·③(키 이름 마스킹을 그대로 통과한다 ·
   * 열람자가 admin RBAC 뒤로 같다)은 오늘도 그대로 참이다.
   *
   * CS-101이 이 기록을 만든 이유는 그대로 지켜진다: **"금액이 혼자 바뀌었어요"** 는 금액 두 개면
   * 답이 되고, 그 두 값은 봉투에 그대로 있다(금액·날짜·분류 id·버전).
   *
   * ⚠️ 다음 사람에게: 이 두 `record` 호출에 `result.before`/`result.after` 말고 **다른 지출
   * 모양**(`toExpenseDto`·`toExpenseSnapshot`·응답 DTO)을 실으면 그 순간 위 규율이 다시 깨진다.
   * `apps/api/test/audit-envelope-sweep.test.ts`가 그 회귀를 먼저 잡는다.
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
