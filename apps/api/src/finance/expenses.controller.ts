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
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
import { CreateExpenseDto, UpdateExpenseDto } from "./dto/expense.dto";
import { YearMonthQueryDto } from "./dto/query.dto";

@Controller("children/:childId/expenses")
@UseGuards(JwtAuthGuard)
export class ChildExpensesController {
  constructor(@Inject(OnboardingStoreService) private readonly store: OnboardingStoreService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(YearMonthQueryDto)) query: YearMonthQueryDto
  ) {
    return await this.store.listExpenses(request.user!, childId, query.yearMonth);
  }

  @Post()
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Body(createDtoValidationPipe(CreateExpenseDto)) body: CreateExpenseDto
  ) {
    return await this.store.createExpense(request.user!, childId, body);
  }
}

@Controller("expenses")
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(
    @Inject(OnboardingStoreService) private readonly store: OnboardingStoreService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

  @Get(":expenseId")
  async get(@Req() request: AuthenticatedRequest, @Param("expenseId") expenseId: string) {
    return await this.store.getExpense(request.user!, expenseId);
  }

  @Patch(":expenseId")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("expenseId") expenseId: string,
    @Body(createDtoValidationPipe(UpdateExpenseDto)) body: UpdateExpenseDto
  ) {
    return await this.store.updateExpense(request.user!, expenseId, body);
  }

  @Delete(":expenseId")
  async delete(@Req() request: AuthenticatedRequest, @Param("expenseId") expenseId: string) {
    const result = await this.store.deleteExpense(request.user!, expenseId);
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
