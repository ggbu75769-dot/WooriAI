import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { getSeoulMonthRange, type ExpenseSource, type ExpenseType, type PaymentMethod } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { ChildAccessService } from "./child-access.service";
import {
  assertNotFutureDate,
  cleanOptionalText,
  requireMoneyKrw,
  toDateOnly,
  toExpenseDto,
  type DbClient,
  type ExpenseRow
} from "./store-shared";

export type CreateExpenseInput = {
  categoryId: string;
  amountKrw: number;
  spentOn: string;
  itemName: string;
  merchant?: string;
  paymentMethod?: PaymentMethod;
  memo?: string;
  linkedItemTemplateId?: string;
  expenseType?: ExpenseType;
  source?: ExpenseSource;
};

export type UpdateExpenseInput = {
  categoryId?: string;
  amountKrw?: number;
  spentOn?: string;
  itemName?: string;
  memo?: string | null;
  expenseType?: ExpenseType;
};

/**
 * REF-118: expense CRUD + aggregation split out of the former
 * onboarding-store.service.ts god service. Public HTTP contract (via
 * finance/expenses.service.ts delegation), error codes and response shapes are
 * unchanged. Also hosts the row-level insert (`insertExpense`) that the import
 * pipeline reuses inside its confirm transaction, and the expense aggregation
 * helpers (sumExpenses/expensesForChild/totalExpenseKrw) the budget and
 * reporting services build on.
 */
@Injectable()
export class ExpensesStoreService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChildAccessService) private readonly childAccess: ChildAccessService
  ) {}

  async createExpense(user: AuthenticatedUser, childId: string, input: CreateExpenseInput) {
    const child = await this.childAccess.requireChildAccess(user, childId, true);
    const created = await this.insertExpense(this.prisma, child.householdId, childId, user, input);
    return toExpenseDto(created);
  }

  async listExpenses(user: AuthenticatedUser, childId: string, yearMonth?: string) {
    await this.childAccess.requireChildAccess(user, childId);
    const expenses = await this.expensesForChild(childId, yearMonth);
    return {
      expenses: expenses.map((expense) => toExpenseDto(expense)),
      totalAmountKrw: this.totalExpenseKrw(expenses)
    };
  }

  async getExpense(user: AuthenticatedUser, expenseId: string) {
    return toExpenseDto(await this.requireExpenseAccess(user, expenseId));
  }

  async updateExpense(user: AuthenticatedUser, expenseId: string, input: UpdateExpenseInput) {
    const expense = await this.requireExpenseAccess(user, expenseId, true);
    const data: Prisma.ExpenseUpdateInput = {};

    if (input.categoryId !== undefined) {
      await this.requireExistingCategory(input.categoryId);
      data.categoryId = input.categoryId;
    }
    if (input.amountKrw !== undefined) data.amountKrw = requireMoneyKrw(input.amountKrw);
    if (input.spentOn !== undefined) {
      assertNotFutureDate(input.spentOn);
      data.spentOn = toDateOnly(input.spentOn);
    }
    if (input.itemName !== undefined) {
      const itemName = input.itemName.trim();
      if (!itemName) {
        throw new BadRequestException({ code: "EXPENSE_ITEM_NAME_REQUIRED", message: "품목명을 입력해 주세요." });
      }
      data.itemName = itemName;
    }
    if (input.memo !== undefined) data.memo = cleanOptionalText(input.memo ?? undefined);
    if (input.expenseType !== undefined) data.expenseType = input.expenseType;

    const updated = await this.prisma.expense.update({ where: { id: expense.id }, data });
    return toExpenseDto(updated);
  }

  async deleteExpense(user: AuthenticatedUser, expenseId: string) {
    const expense = await this.requireExpenseAccess(user, expenseId, true);
    const before = toExpenseDto(expense);
    const now = new Date();
    const deleted = await this.prisma.expense.update({
      where: { id: expense.id },
      data: { deletedAt: now, deletedByUserId: user.id }
    });
    return {
      success: true,
      householdId: deleted.householdId,
      before,
      after: { ...before, deletedAt: deleted.deletedAt?.toISOString() ?? null }
    };
  }

  /**
   * Row-level insert shared by createExpense and the import pipeline's confirm
   * transaction (which passes its own transaction client). Validation order and
   * error codes are unchanged from the god-service original.
   */
  async insertExpense(
    client: DbClient,
    householdId: string,
    childId: string,
    user: AuthenticatedUser,
    input: CreateExpenseInput
  ): Promise<ExpenseRow> {
    const itemName = input.itemName.trim();
    if (!itemName) {
      throw new BadRequestException({ code: "EXPENSE_ITEM_NAME_REQUIRED", message: "품목명을 입력해 주세요." });
    }
    assertNotFutureDate(input.spentOn);
    await this.requireExistingCategory(input.categoryId, client);
    if (input.linkedItemTemplateId) {
      await this.requireExistingItemTemplateAnyStatus(input.linkedItemTemplateId, client);
    }

    return client.expense.create({
      data: {
        householdId,
        childId,
        createdByUserId: user.id,
        categoryId: input.categoryId,
        amountKrw: requireMoneyKrw(input.amountKrw),
        spentOn: toDateOnly(input.spentOn),
        itemName,
        merchant: cleanOptionalText(input.merchant),
        paymentMethod: input.paymentMethod ?? "unknown",
        memo: cleanOptionalText(input.memo),
        linkedItemTemplateId: input.linkedItemTemplateId ?? null,
        expenseType: input.expenseType ?? "expense",
        source: input.source ?? "manual"
      }
    });
  }

  async requireExpenseAccess(user: AuthenticatedUser, expenseId: string, edit = false): Promise<ExpenseRow> {
    const expense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.deletedAt) {
      throw new NotFoundException({ code: "EXPENSE_NOT_FOUND", message: "지출 기록을 찾을 수 없어요." });
    }

    await this.childAccess.requireChildAccess(user, expense.childId, edit);
    return expense;
  }

  async requireExpenseBelongsToChild(user: AuthenticatedUser, expenseId: string, childId: string) {
    const expense = await this.requireExpenseAccess(user, expenseId, true);
    if (expense.childId !== childId) {
      throw new ForbiddenException({ code: "EXPENSE_CHILD_MISMATCH", message: "지출 기록이 해당 아이 소속이 아니에요." });
    }
    return expense;
  }

  async requireExistingCategory(categoryId: string, client: DbClient = this.prisma) {
    const exists = await client.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!exists) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "존재하지 않는 카테고리예요. 카테고리를 다시 선택해 주세요."
      });
    }
  }

  private async requireExistingItemTemplateAnyStatus(itemTemplateId: string, client: DbClient = this.prisma) {
    const exists = await client.itemTemplate.findUnique({ where: { id: itemTemplateId }, select: { id: true } });
    if (!exists) {
      throw new BadRequestException({ code: "EXPENSE_LINKED_ITEM_TEMPLATE_INVALID", message: "연결된 준비템을 찾을 수 없어요." });
    }
  }

  async expensesForChild(childId: string, yearMonth?: string): Promise<ExpenseRow[]> {
    const range = yearMonth ? getSeoulMonthRange(yearMonth) : null;
    return this.prisma.expense.findMany({
      where: {
        childId,
        deletedAt: null,
        ...(range ? { spentOn: { gte: toDateOnly(range.startInclusive), lt: toDateOnly(range.endExclusive) } } : {})
      },
      orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }]
    });
  }

  totalExpenseKrw(expenses: ExpenseRow[]) {
    return expenses.filter((expense) => expense.expenseType === "expense").reduce((sum, expense) => sum + expense.amountKrw, 0);
  }

  async sumExpenses(childId: string, range: { startInclusive: string; endExclusive: string }) {
    const result = await this.prisma.expense.aggregate({
      where: {
        childId,
        deletedAt: null,
        expenseType: "expense",
        spentOn: { gte: toDateOnly(range.startInclusive), lt: toDateOnly(range.endExclusive) }
      },
      _sum: { amountKrw: true }
    });
    return result._sum.amountKrw ?? 0;
  }
}
