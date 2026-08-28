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
