import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { Expense as PrismaExpense, Prisma } from "@prisma/client";
import type { MemberRole } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
import { toDeletedExpenseSnapshot, toExpenseSnapshot } from "./expense-snapshot";
import type { UpdateExpenseDto } from "./dto/expense.dto";

function memberRoleFor(user: AuthenticatedUser, householdId: string): MemberRole | null {
  return user.households.find((household) => household.id === householdId)?.role ?? null;
}

function canEdit(role: MemberRole | null) {
  return role === "owner" || role === "co_parent";
}

const VERSION_CONFLICT_MESSAGE = "다른 곳에서 먼저 변경됐어요. 최신 내용을 다시 불러와 주세요.";

export const EXPENSE_VERSION_TRANSACTION_HOOK = Symbol("EXPENSE_VERSION_TRANSACTION_HOOK");

export type ExpenseVersionTransactionHook = {
  afterMutation: (operation: "update" | "delete", expenseId: string) => void | Promise<void>;
};

const NOOP_TRANSACTION_HOOK: ExpenseVersionTransactionHook = {
  afterMutation: () => undefined
};

/**
 * Owns MOB-103's optimistic-concurrency layer for expenses: `version` exposure,
 * `expectedVersion` conditional update/delete, and the 409 VERSION_CONFLICT
 * contract (design doc docs/5차/round5a-sprint1-plan.md §2.2).
 *
 * Deliberately does NOT reimplement expense field validation/business rules
 * (category existence, future-date checks, item-name trimming, household
 * access, ...) -- those stay owned by OnboardingStoreService.{create,update,
 * delete,get,list}Expense, which this service delegates to. This file only
 * adds the version bookkeeping around those calls, specifically so it never
 * needs to edit onboarding-store.service.ts (owned by concurrent work this
 * sprint).
 *
 * Optimistic-lock mechanics: authorization, version CAS, field mutation, and
 * final read all use one Prisma transaction client. Winning the CAS serializes
 * concurrent requests against the same version; any later validation/runtime
 * failure rolls the whole transaction back, so neither the payload nor version
 * can commit alone.
 */
@Injectable()
export class ExpensesVersionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OnboardingStoreService) private readonly store: OnboardingStoreService,
    @Optional()
    @Inject(EXPENSE_VERSION_TRANSACTION_HOOK)
    private readonly transactionHook: ExpenseVersionTransactionHook = NOOP_TRANSACTION_HOOK
  ) {}

  async getExpense(user: AuthenticatedUser, expenseId: string) {
    const dto = await this.store.getExpense(user, expenseId);
    return this.hydrateOne(dto as { id: string });
  }

  async listExpenses(user: AuthenticatedUser, childId: string, yearMonth?: string) {
    const result = await this.store.listExpenses(user, childId, yearMonth);
    const typed = result as { expenses: Array<{ id: string }>; totalAmountKrw: number };
    return {
      expenses: await this.hydrateMany(typed.expenses),
      totalAmountKrw: typed.totalAmountKrw
    };
  }

  async listExpenseShortcuts(user: AuthenticatedUser, childId: string) {
    return this.store.listExpenseShortcuts(user, childId);
  }

  async hydrateHome<T extends { recentExpenses: Array<{ id: string }> }>(home: T): Promise<T> {
    return { ...home, recentExpenses: await this.hydrateMany(home.recentExpenses) };
  }

  async createExpense(
    user: AuthenticatedUser,
    childId: string,
    input: Parameters<OnboardingStoreService["createExpense"]>[2]
  ) {
    const dto = await this.store.createExpense(user, childId, input);
    return this.hydrateOne(dto as { id: string });
  }

  async updateExpense(user: AuthenticatedUser, expenseId: string, body: UpdateExpenseDto) {
    const { expectedVersion, ...fields } = body;
    return this.prisma.$transaction(async (tx) => {
      const raw = await tx.expense.findUnique({ where: { id: expenseId } });
      this.authorizeExpenseRow(user, raw, true);

      if (expectedVersion === undefined) {
        const updated = await this.store.updateExpense(user, expenseId, fields, tx);
        const bumped = await tx.expense.update({
          where: { id: expenseId },
          data: { version: { increment: 1 } }
        });
        await this.transactionHook.afterMutation("update", expenseId);
        return { ...(updated as Record<string, unknown>), version: bumped.version };
      }

      const gate = await tx.expense.updateMany({
        where: { id: expenseId, version: expectedVersion, deletedAt: null },
        data: { version: { increment: 1 } }
      });
      if (gate.count === 0) {
        throw await this.versionConflictFor(expenseId, tx);
      }

      const updated = await this.store.updateExpense(user, expenseId, fields, tx);
      const final = await tx.expense.findUnique({ where: { id: expenseId }, select: { version: true } });
      await this.transactionHook.afterMutation("update", expenseId);
      return { ...(updated as Record<string, unknown>), version: final?.version ?? expectedVersion + 1 };
    });
  }

  async deleteExpense(user: AuthenticatedUser, expenseId: string, expectedVersion?: number) {
    return this.prisma.$transaction(async (tx) => {
      const raw = await tx.expense.findUnique({ where: { id: expenseId } });
      this.authorizeExpenseRow(user, raw, true);

      if (expectedVersion === undefined) {
        const result = await this.store.deleteExpense(user, expenseId, tx);
        await tx.expense.update({ where: { id: expenseId }, data: { version: { increment: 1 } } });
        await this.transactionHook.afterMutation("delete", expenseId);
        return result;
      }

      const gate = await tx.expense.updateMany({
        where: { id: expenseId, version: expectedVersion, deletedAt: null },
        data: { version: { increment: 1 } }
      });
      if (gate.count === 0) {
        throw await this.versionConflictFor(expenseId, tx);
      }

      const result = await this.store.deleteExpense(user, expenseId, tx);
      await this.transactionHook.afterMutation("delete", expenseId);
      return result;
    });
  }

  private async versionConflictFor(expenseId: string, client: Prisma.TransactionClient | PrismaService = this.prisma) {
    const row = await client.expense.findUnique({ where: { id: expenseId } });
    const current = !row ? null : row.deletedAt ? toDeletedExpenseSnapshot(row) : toExpenseSnapshot(row);
    return new HttpException(
      { code: "VERSION_CONFLICT", message: VERSION_CONFLICT_MESSAGE, current },
      HttpStatus.CONFLICT
    );
  }

  private authorizeExpenseRow(
    user: AuthenticatedUser,
    row: PrismaExpense | null,
    requireEdit: boolean
  ): PrismaExpense {
    if (!row) {
      throw new NotFoundException({ code: "EXPENSE_NOT_FOUND", message: "지출 기록을 찾을 수 없어요." });
    }
    const role = memberRoleFor(user, row.householdId);
    if (!role || (requireEdit && !canEdit(role))) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "지출 기록 접근 권한이 없어요." });
    }
    return row;
  }

  private async hydrateOne<T extends { id: string }>(dto: T): Promise<T & { version: number }> {
    const row = await this.prisma.expense.findUnique({ where: { id: dto.id }, select: { version: true } });
    return { ...dto, version: row?.version ?? 1 };
  }

  private async hydrateMany<T extends { id: string }>(dtos: T[]): Promise<Array<T & { version: number }>> {
    if (dtos.length === 0) return [];
    const rows = await this.prisma.expense.findMany({
      where: { id: { in: dtos.map((dto) => dto.id) } },
      select: { id: true, version: true }
    });
    const versionById = new Map(rows.map((row) => [row.id, row.version]));
    return dtos.map((dto) => ({ ...dto, version: versionById.get(dto.id) ?? 1 }));
  }
}
