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
import { ExpenseDeleteQueryDto, ExpenseListQueryDto } from "./dto/query.dto";
import { ExpensesVersionService } from "./expenses.service";

@Controller("children/:childId/expenses")
@UseGuards(JwtAuthGuard)
export class ChildExpensesController {
  constructor(@Inject(ExpensesVersionService) private readonly expenses: ExpensesVersionService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(ExpenseListQueryDto)) query: ExpenseListQueryDto
  ) {
    return await this.expenses.listExpenses(request.user!, childId, query.yearMonth, {
      categoryId: query.categoryId,
      cursor: query.cursor,
      limit: query.limit,
      search: query.search
    });
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

@Controller("children/:childId/expense-shortcuts")
@UseGuards(JwtAuthGuard)
export class ExpenseShortcutsController {
  constructor(@Inject(ExpensesVersionService) private readonly expenses: ExpensesVersionService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Param("childId") childId: string) {
    return await this.expenses.listExpenseShortcuts(request.user!, childId);
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

  @Patch(":expenseId")
  @UseInterceptors(IdempotencyInterceptor)
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("expenseId") expenseId: string,
    @Body(createDtoValidationPipe(UpdateExpenseDto)) body: UpdateExpenseDto
  ) {
    return await this.expenses.updateExpense(request.user!, expenseId, body);
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
