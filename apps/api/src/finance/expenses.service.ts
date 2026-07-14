import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Expense as PrismaExpense } from "@prisma/client";
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
 * Optimistic-lock mechanics: `expectedVersion` conflict detection is a
 * compare-and-swap directly on the `version` column (`updateMany` scoped to
 * `id + version + deletedAt: null`), performed *before* delegating to the
 * store's own field mutation. Winning the CAS is what serializes concurrent
 * requests against the same version -- a loser's `updateMany` affects 0 rows
 * and short-circuits to the conflict branch before the store's own update
 * ever runs. If the store call subsequently throws (e.g. validation error),
 * the CAS's version bump is rolled back so a rejected request never burns a
 * version number.
 */
@Injectable()
export class ExpensesVersionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OnboardingStoreService) private readonly store: OnboardingStoreService
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
    const raw = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    this.authorizeExpenseRow(user, raw, true);

    if (expectedVersion === undefined) {
      const updated = await this.store.updateExpense(user, expenseId, fields);
      const bumped = await this.prisma.expense.update({
        where: { id: expenseId },
        data: { version: { increment: 1 } }
      });
      return { ...(updated as Record<string, unknown>), version: bumped.version };
    }

    const gate = await this.prisma.expense.updateMany({
      where: { id: expenseId, version: expectedVersion, deletedAt: null },
      data: { version: { increment: 1 } }
    });
    if (gate.count === 0) {
      throw await this.versionConflictFor(expenseId);
    }

    try {
      const updated = await this.store.updateExpense(user, expenseId, fields);
      const final = await this.prisma.expense.findUnique({ where: { id: expenseId }, select: { version: true } });
      return { ...(updated as Record<string, unknown>), version: final?.version ?? expectedVersion + 1 };
    } catch (error) {
      await this.rollbackVersionBump(expenseId, expectedVersion);
      throw error;
    }
  }

  async deleteExpense(user: AuthenticatedUser, expenseId: string, expectedVersion?: number) {
    const raw = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    this.authorizeExpenseRow(user, raw, true);

    if (expectedVersion === undefined) {
      const result = await this.store.deleteExpense(user, expenseId);
      await this.prisma.expense.update({ where: { id: expenseId }, data: { version: { increment: 1 } } });
      return result;
    }

    const gate = await this.prisma.expense.updateMany({
      where: { id: expenseId, version: expectedVersion, deletedAt: null },
      data: { version: { increment: 1 } }
    });
    if (gate.count === 0) {
      throw await this.versionConflictFor(expenseId);
    }

    try {
      return await this.store.deleteExpense(user, expenseId);
    } catch (error) {
      await this.rollbackVersionBump(expenseId, expectedVersion);
      throw error;
    }
  }

  private async rollbackVersionBump(expenseId: string, expectedVersion: number) {
    // 우리 CAS가 만든 bump(expectedVersion+1)가 아직 최신일 때만 되돌린다.
    // 그 사이 다른 요청이 성공해 version이 더 나아갔다면 깎으면 안 된다(버전 역행 방지).
    await this.prisma.expense
      .updateMany({
        where: { id: expenseId, version: expectedVersion + 1 },
        data: { version: { decrement: 1 } }
      })
      .catch(() => undefined);
  }

  private async versionConflictFor(expenseId: string) {
    const row = await this.prisma.expense.findUnique({ where: { id: expenseId } });
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
