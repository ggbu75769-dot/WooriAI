import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  assertMoneyKrw,
  calculateChildStage,
  getSeoulMonthRange,
  getSeoulToday,
  isFutureSeoulDate,
  isValidCalendarDate,
  type ChildStageCode,
  type ChildStageMode,
  type ExpenseSource,
  type ExpenseType,
  type ItemStatus,
  type MemberRole,
  type PaymentMethod
} from "@wooriai/domain";
import type { AuthenticatedUser } from "../common/types/authenticated-request";

/**
 * REF-118: shared row types, DTO mappers and validation helpers split out of the
 * former onboarding-store.service.ts god service. Everything here is pure
 * (no Prisma access, no DI) and is consumed by the decomposed store services:
 * onboarding-core, expenses-store, items-catalog, import-pipeline,
 * reporting-store (all in this directory).
 *
 * R19-B 예외 1건: `markLinkedItemPrepared`만 순수 함수가 아니다 — 호출자가 넘긴
 * DbClient로 child_item_statuses를 upsert한다 (DI는 여전히 없다). 여기 두는
 * 이유는 순환 의존 때문이다: ItemsCatalogService가 이미 ExpensesStoreService를
 * 주입하고 있어(updateItemStatus의 expenseId 검증), 반대로 expenses-store가
 * items-catalog를 주입하면 DI 사이클이 된다. 그래서 "지출↔준비템 상태" 규칙을
 * 양쪽이 공유할 수 있는 이 모듈의 공용 함수로 뽑았다.
 */

export type DbClient = Prisma.TransactionClient;

export type ChildRow = {
  id: string;
  householdId: string;
  nickname: string;
  stageMode: ChildStageMode;
  dueDate: Date | null;
  birthDate: Date | null;
  manualStage: ChildStageCode | null;
  preparedItemsSetAt: Date | null;
  deletedAt: Date | null;
};

export type ExpenseRow = {
  id: string;
  childId: string;
  householdId: string;
  categoryId: string;
  amountKrw: number;
  spentOn: Date;
  itemName: string;
  merchant: string | null;
  paymentMethod: PaymentMethod;
  memo: string | null;
  linkedItemTemplateId: string | null;
  expenseType: ExpenseType;
  source: ExpenseSource;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export function memberRoleFor(user: AuthenticatedUser, householdId: string): MemberRole | null {
  return user.households.find((household) => household.id === householdId)?.role ?? null;
}

export function canEdit(role: MemberRole | null) {
  return role === "owner" || role === "co_parent";
}

export function toDateOnly(dateOnly: string): Date {
  return new Date(`${dateOnly.slice(0, 10)}T00:00:00.000Z`);
}

export function fromDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toChildDto(child: ChildRow) {
  const today = process.env.WOORIAI_STAGE_TODAY;
  const calculated =
    child.stageMode === "pregnant"
      ? calculateChildStage({ stageMode: "pregnant", dueDate: fromDateOnly(child.dueDate!), today })
      : child.stageMode === "born"
        ? calculateChildStage({ stageMode: "born", birthDate: fromDateOnly(child.birthDate!), today })
        : calculateChildStage({ stageMode: "manual", manualStage: child.manualStage!, today });

  return {
    id: child.id,
    householdId: child.householdId,
    nickname: child.nickname,
    stageMode: child.stageMode,
    dueDate: child.dueDate ? fromDateOnly(child.dueDate) : null,
    birthDate: child.birthDate ? fromDateOnly(child.birthDate) : null,
    manualStage: child.manualStage ?? null,
    currentStage: calculated.stageCode,
    stageLabel: calculated.stageLabel
  };
}

export type ChildDto = ReturnType<typeof toChildDto>;

export function toExpenseDto(expense: ExpenseRow) {
  return {
    id: expense.id,
    childId: expense.childId,
    categoryId: expense.categoryId,
    amountKrw: expense.amountKrw,
    spentOn: fromDateOnly(expense.spentOn),
    itemName: expense.itemName,
    merchant: expense.merchant ?? null,
    memo: expense.memo ?? null,
    expenseType: expense.expenseType,
    source: expense.source,
    createdByUserId: expense.createdByUserId
  };
}

/** Pure DTO assembly shared by OnboardingCore's toBudgetDto and ReportingStore's getHome
 *  (PERF-103), so getHome can fetch usedAmountKrw inside its Promise.all without changing
 *  the response shape. */
export function buildBudgetDto(childId: string, yearMonth: string, amountKrw: number, usedAmountKrw: number) {
  return {
    childId,
    yearMonth,
    amountKrw,
    usedAmountKrw,
    remainingAmountKrw: amountKrw - usedAmountKrw
  };
}

export function currentYearMonth() {
  return getSeoulMonthRange(process.env.WOORIAI_STAGE_TODAY ?? getSeoulToday()).yearMonth;
}

export function currentYear() {
  return currentYearMonth().slice(0, 4);
}

export function referenceNow() {
  return process.env.WOORIAI_STAGE_TODAY
    ? new Date(`${process.env.WOORIAI_STAGE_TODAY}T00:00:00+09:00`)
    : new Date();
}

export function assertNotFutureDate(spentOn: string) {
  if (!isValidCalendarDate(spentOn)) {
    throw new BadRequestException({ code: "EXPENSE_DATE_INVALID", message: "날짜를 다시 확인해 주세요." });
  }

  try {
    if (isFutureSeoulDate(spentOn, referenceNow())) {
      throw new BadRequestException({ code: "EXPENSE_FUTURE_DATE", message: "미래 날짜의 지출은 저장할 수 없어요." });
    }
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException({ code: "EXPENSE_DATE_INVALID", message: "날짜를 다시 확인해 주세요." });
  }
}

export function requireMoneyKrw(value: unknown) {
  try {
    return assertMoneyKrw(value);
  } catch {
    throw new BadRequestException({ code: "EXPENSE_AMOUNT_INVALID", message: "금액은 0보다 큰 원화 정수만 입력할 수 있어요." });
  }
}

export function cleanOptionalText(value?: string) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

/**
 * 사용자가 스스로 "이미 해결됐다"고 고른 상태들 — 지출 기록이 덮어쓰면 안 된다.
 * `gifted`(선물로 받음)와 `not_needed`(안 살래요)는 둘 다 "이 준비템은 더 이상
 * 사야 할 대상이 아니다"라는 사용자 판단이고, 연결된 지출이 하나 생겼다고 해서
 * 그 판단을 `prepared`로 바꿔 쓰는 것은 사용자 입력을 임의로 고쳐 쓰는 것이다
 * (예: 선물로 받은 유모차의 부속품 지출을 남겨도 "선물로 받음"은 유지돼야 한다).
 * `not_prepared`/`interested`/미존재는 아직 아무 판단이 없는 상태라 자동 표시 대상.
 */
const RESOLVED_ITEM_STATUSES: ReadonlySet<ItemStatus> = new Set<ItemStatus>(["gifted", "not_needed"]);

export type MarkLinkedItemPreparedResult = "marked" | "linked" | "preserved";

/**
 * R19-B / DNC-002 핵심 루프의 마지막 고리: "구매 후 기록 → 준비템 상태 체크".
 * `linkedItemTemplateId`가 붙은 지출이 생기면 그 준비템을 자동으로 `prepared`로
 * 올린다 — 지출을 남겼는데도 준비템이 영원히 미준비로 남아 ITEM-114 준비율이
 * 정체되던 문제(정찰 발견 2)를 없앤다.
 *
 * 규칙
 * - 상태 행이 없거나 `not_prepared`/`interested`면 `prepared`로 올리고 expenseId를 연결한다.
 * - 이미 `gifted`/`not_needed`면 **아무것도 하지 않는다** (RESOLVED_ITEM_STATUSES 주석 참고).
 * - 이미 `prepared`면 상태는 그대로 두고, 연결된 지출이 없을 때만 expenseId를 채운다
 *   (먼저 연결된 지출 기록을 나중 지출이 밀어내지 않도록 — 최초 연결을 보존).
 * - 지출 삭제 시 되돌리지 않는다 (deleteExpense 주석 참고).
 * - 지출 종류(expense/gift)는 구분하지 않고 항상 `prepared`다. `gifted`는 사용자가
 *   직접 고르는 상태이지 자동 부여 대상이 아니고, 준비템 `prepared` 탭과 준비율이
 *   읽는 상태가 `prepared`이기 때문이다.
 *
 * ⚠️ 접근검증은 하지 않는다 — 호출자(insertExpense)가 이미 통과시킨 childId/지출에
 * 대해서만 호출된다. itemTemplateId 존재 여부도 호출자가 먼저 검증한다.
 */
export async function markLinkedItemPrepared(
  client: DbClient,
  params: { childId: string; itemTemplateId: string; userId: string; expenseId: string }
): Promise<MarkLinkedItemPreparedResult> {
  const { childId, itemTemplateId, userId, expenseId } = params;
  const existing = await client.childItemStatus.findUnique({
    where: { childId_itemTemplateId: { childId, itemTemplateId } },
    select: { status: true, expenseId: true }
  });

  if (existing && RESOLVED_ITEM_STATUSES.has(existing.status)) {
    return "preserved";
  }

  if (existing?.status === "prepared") {
    if (existing.expenseId) return "preserved";
    await client.childItemStatus.update({
      where: { childId_itemTemplateId: { childId, itemTemplateId } },
      data: { expenseId, updatedByUserId: userId }
    });
    return "linked";
  }

  // upsert(= INSERT ... ON CONFLICT DO UPDATE)로 쓴다: 위 findUnique 이후 같은
  // (childId, itemTemplateId)에 동시 삽입이 끼어들어도 유니크 위반 대신 update로 흡수된다.
  await client.childItemStatus.upsert({
    where: { childId_itemTemplateId: { childId, itemTemplateId } },
    update: { status: "prepared", expenseId, updatedByUserId: userId },
    create: { childId, itemTemplateId, status: "prepared", expenseId, updatedByUserId: userId }
  });
  return "marked";
}
