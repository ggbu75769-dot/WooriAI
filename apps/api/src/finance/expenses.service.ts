import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { Expense as PrismaExpense } from "@prisma/client";
import type { MemberRole } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { ExpensesStoreService } from "../onboarding/expenses-store.service";
import { PushDispatchService } from "../push/push-dispatch.service";
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
 * access, ...) -- those stay owned by ExpensesStoreService.{create,update,
 * delete,get,list}Expense, which this service delegates to. This file only
 * adds the version bookkeeping around those calls, specifically so it never
 * needs to edit the onboarding store services (owned by concurrent work this
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
    @Inject(ExpensesStoreService) private readonly store: ExpensesStoreService,
    // PUSH-113: 전역 PushModule이 제공하는 발송 훅. @Optional() — 이 서비스만 따로
    // 조립하는 단위 테스트/부분 모듈에서는 없어도 되고, 그 경우 훅은 그냥 건너뛴다.
    @Optional() @Inject(PushDispatchService) private readonly pushDispatch?: PushDispatchService
  ) {}

  async getExpense(user: AuthenticatedUser, expenseId: string) {
    const dto = await this.store.getExpense(user, expenseId);
    return this.hydrateOne(dto as { id: string });
  }

  /**
   * API-124: 목록 페이지네이션은 스토어(ExpensesStoreService.listExpenses)가 소유한다 —
   * 정렬 계약과 커서 술어가 한 곳에 있어야 하기 때문. 여기서는 종전처럼 version만
   * 덧입히고 `hasMore`/`nextCursor`를 그대로 통과시킨다. hydrateMany의 2차 조회도
   * 이제 전량이 아니라 페이지(최대 limit건)에만 걸린다.
   */
  async listExpenses(
    user: AuthenticatedUser,
    childId: string,
    query: { yearMonth?: string; limit?: number; cursor?: string } = {}
  ) {
    const result = await this.store.listExpenses(user, childId, query.yearMonth, {
      limit: query.limit,
      cursor: query.cursor
    });
    const typed = result as {
      expenses: Array<{ id: string }>;
      totalAmountKrw: number;
      hasMore: boolean;
      nextCursor: string | null;
    };
    return {
      expenses: await this.hydrateMany(typed.expenses),
      totalAmountKrw: typed.totalAmountKrw,
      hasMore: typed.hasMore,
      nextCursor: typed.nextCursor
    };
  }

  async hydrateHome<T extends { recentExpenses: Array<{ id: string }> }>(home: T): Promise<T> {
    return { ...home, recentExpenses: await this.hydrateMany(home.recentExpenses) };
  }

  async createExpense(
    user: AuthenticatedUser,
    childId: string,
    input: Parameters<ExpensesStoreService["createExpense"]>[2]
  ) {
    const dto = await this.store.createExpense(user, childId, input);
    // PUSH-113: 지출 생성 직후, 활성 디바이스들로 예산 경계 푸시 발송을 시도한다.
    // fire-and-forget — PushDispatchService.onExpenseCreated는 예외를 절대 던지지
    // 않으므로(내부에서 전부 삼키고 로그) 실패해도 지출 생성 응답/인앱 알림 흐름에
    // 영향이 없다. push 비활성 시에는 즉시 no-op.
    void this.pushDispatch?.onExpenseCreated((dto as { id: string }).id);
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
