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
