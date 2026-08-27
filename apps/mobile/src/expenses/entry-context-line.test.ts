import { describe, expect, it } from "vitest";
import { buildEntryContextLine, type EntryContextServerExpense } from "./entry-context-line";
import type { LocalExpenseRow } from "../offline/types";

/**
 * UX-K(A): 입력 시점의 "이번 달 지금까지" 한 줄.
 *
 * 여기서 지키는 것은 세 가지다.
 *  1. 합계가 기록 탭과 **같은 규칙**으로 나온다 — 선물·환불 제외(DNC-015), 로컬 대기 행 포함,
 *     로컬 변경이 걸린 낡은 서버 행 제외(reconcileMonthlyExpenses).
 *  2. 캐시가 없으면 아무 말도 하지 않는다 — "0원"이라고 말하면 그건 없는 사실이다.
 *  3. 지난달 지출을 적는 중이면 이번 달 합계를 옆에 붙이지 않는다.
 */

const DIAPER = "c0a7e901-0000-4c01-8c01-c47e900ec001";
const CLOTHES = "c0a7e901-0000-4c04-8c04-c47e900ec004";

function serverExpense(partial: Partial<EntryContextServerExpense> & { id: string }): EntryContextServerExpense {
  return {
    categoryId: DIAPER,
    amountKrw: 10_000,
    expenseType: "expense",
    ...partial
  };
}

function offlineRow(partial: {
  localId: string;
  childId?: string;
  canonicalId?: string | null;
  syncState?: LocalExpenseRow["syncState"];
  pendingDelete?: boolean;
  spentOn?: string;
  amountKrw?: number;
  categoryId?: string;
  expenseType?: "expense" | "gift";
}): LocalExpenseRow {
  return {
    localId: partial.localId,
    canonicalId: partial.canonicalId ?? null,
    childId: partial.childId ?? "child-1",
    payload: {
      childId: partial.childId ?? "child-1",
      categoryId: partial.categoryId ?? DIAPER,
      amountKrw: partial.amountKrw ?? 5_000,
      spentOn: partial.spentOn ?? "2026-08-20",
      itemName: "기저귀",
      expenseType: partial.expenseType ?? "expense"
    },
    version: null,
    syncState: partial.syncState ?? "pending",
    pendingDelete: partial.pendingDelete ?? false,
    conflictCurrent: null,
    lastError: null,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z"
  };
}

const baseInput = {
  cacheYearMonth: "2026-08",
  entryYearMonth: "2026-08",
  offlineRows: [] as LocalExpenseRow[],
  childId: "child-1",
  selectedCategory: null
};

describe("buildEntryContextLine — 캐시가 없을 때", () => {
  it("캐시가 아예 없으면(콜드 스타트) 줄 자체를 만들지 않는다 — 0원이라고 말하지 않는다", () => {
    expect(buildEntryContextLine({ ...baseInput, cachedMonthExpenses: undefined })).toBeNull();
    expect(buildEntryContextLine({ ...baseInput, cachedMonthExpenses: null })).toBeNull();
  });

  it("캐시가 비어 있어도(이번 달 기록 0건) 말할 숫자가 없으므로 생략한다", () => {
    expect(buildEntryContextLine({ ...baseInput, cachedMonthExpenses: [] })).toBeNull();
  });

  it("이번 달이 전부 선물이면 합계가 0이라 줄을 그리지 않는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [serverExpense({ id: "e1", expenseType: "gift", amountKrw: 80_000 })]
    });
    expect(line).toBeNull();
  });
});

describe("buildEntryContextLine — 월 합계", () => {
  it("월 합계 한 줄을 만든다 (카테고리 미선택)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [
        serverExpense({ id: "e1", amountKrw: 1_200_000 }),
        serverExpense({ id: "e2", amountKrw: 45_700, categoryId: CLOTHES })
      ]
    });
    expect(line?.text).toBe("8월 지금까지 1,245,700원");
    expect(line?.accessibilityLabel).toBe("8월 지금까지 1,245,700원");
  });

  it("선물·환불은 합계에서 빠진다 (DNC-015, 기록 탭과 같은 술어)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [
        serverExpense({ id: "e1", amountKrw: 100_000 }),
        serverExpense({ id: "e2", amountKrw: 80_000, expenseType: "gift" }),
        serverExpense({ id: "e3", amountKrw: 30_000, expenseType: "refund" })
      ]
    });
    expect(line?.text).toBe("8월 지금까지 100,000원");
  });

  it("아직 올라가지 않은 로컬 대기 행도 더한다 (기록 탭 월 합계와 동일)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 100_000 })],
      offlineRows: [offlineRow({ localId: "l1", amountKrw: 7_000 })]
    });
    expect(line?.text).toBe("8월 지금까지 107,000원");
  });

  it("로컬 수정이 걸린 낡은 서버 행은 두 번 세지 않는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 100_000 })],
      offlineRows: [offlineRow({ localId: "l1", canonicalId: "e1", amountKrw: 120_000 })]
    });
    expect(line?.text).toBe("8월 지금까지 120,000원");
  });

  it("다른 아이의 로컬 행은 더하지 않는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 100_000 })],
      offlineRows: [offlineRow({ localId: "l1", childId: "child-2", amountKrw: 999_000 })]
    });
    expect(line?.text).toBe("8월 지금까지 100,000원");
  });
});

describe("buildEntryContextLine — 카테고리 항", () => {
  const cachedMonthExpenses = [
    serverExpense({ id: "e1", amountKrw: 60_000, categoryId: DIAPER }),
    serverExpense({ id: "e2", amountKrw: 40_000, categoryId: CLOTHES }),
    serverExpense({ id: "e3", amountKrw: 80_000, categoryId: DIAPER, expenseType: "gift" })
  ];

  it("선택된 타일의 이번 달 합계를 뒤에 붙인다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses,
      offlineRows: [offlineRow({ localId: "l1", amountKrw: 8_000, categoryId: DIAPER })],
      selectedCategory: { id: DIAPER, label: "기저귀" }
    });
    expect(line?.text).toBe("8월 지금까지 108,000원 · 기저귀 68,000원");
    // 스크린리더에는 가운뎃점 대신 쉼표로 끊어 읽힌다.
    expect(line?.accessibilityLabel).toBe("8월 지금까지 108,000원, 기저귀 68,000원");
  });

  it("카테고리를 넘기지 않으면 월 합계만 말한다", () => {
    const line = buildEntryContextLine({ ...baseInput, cachedMonthExpenses, selectedCategory: null });
    expect(line?.text).toBe("8월 지금까지 100,000원");
  });

  it("그 분류에 이번 달 기록이 없으면 카테고리 항을 붙이지 않는다 (0원이라고 말하지 않는다)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses,
      selectedCategory: { id: "c0a7e901-0000-4c07-8c07-c47e900ec007", label: "교육/도서" }
    });
    expect(line?.text).toBe("8월 지금까지 100,000원");
  });

  it("카테고리 항도 선물을 빼고 센다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses,
      selectedCategory: { id: DIAPER, label: "기저귀" }
    });
    expect(line?.text).toBe("8월 지금까지 100,000원 · 기저귀 60,000원");
  });
});

describe("buildEntryContextLine — 월 경계", () => {
  it("지난달 지출을 적는 중이면 이번 달 합계를 붙이지 않는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      entryYearMonth: "2026-07",
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 100_000 })]
    });
    expect(line).toBeNull();
  });

  it("다른 달 날짜의 로컬 대기 행은 이번 달 합계에 들어가지 않는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 100_000 })],
      offlineRows: [offlineRow({ localId: "l1", amountKrw: 50_000, spentOn: "2026-07-31" })]
    });
    expect(line?.text).toBe("8월 지금까지 100,000원");
  });

  it("한 자리 달은 앞의 0 없이 읽는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cacheYearMonth: "2026-01",
      entryYearMonth: "2026-01",
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_000 })],
      offlineRows: [offlineRow({ localId: "l1", spentOn: "2026-01-05", amountKrw: 2_000 })]
    });
    expect(line?.text).toBe("1월 지금까지 3,000원");
  });

  it("달 형식이 깨져 있으면 아무 말도 하지 않는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cacheYearMonth: "2026-8",
      entryYearMonth: "2026-8",
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_000 })]
    });
    expect(line).toBeNull();
  });
});
