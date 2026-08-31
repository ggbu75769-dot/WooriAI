import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTileCategoryResolver } from "../categories";
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
 *  4. 라운드 85 A — 그 대신 **지난달 캐시가 손에 있으면 그 달의 합계**를 말한다(끝난 달 문구).
 *     캐시가 없거나 두 달 밖의 달이면 여전히 침묵하고, 선택 인자를 넘기지 않은 호출부의 결과는
 *     위 1~3 그대로다.
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

describe("buildEntryContextLine — 라운드 37 G-4: 8타일 밖 분류가 섞인 달", () => {
  // 엑셀 임포트/지출 수정 화면을 거친 행은 서버가 시드한 정식 카테고리 UUID(DB마다 다른 값)를
  // 달고 온다 -- 이 화면의 8타일 어디에도 매칭되지 않아 카테고리 합계에서 통째로 빠진다.
  const SERVER_SEED_CATEGORY = "8f2a1c40-7d3e-4b91-9a55-0f1c2d3e4b5a";

  it("임포트 행이 하나라도 섞여 있으면 카테고리 항을 생략한다 (과소 표기 금지)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [
        serverExpense({ id: "e1", amountKrw: 60_000, categoryId: DIAPER }),
        // 엑셀로 들어온 기저귀 구매 -- 이 화면은 이 행이 어느 분류인지 알 방법이 없다.
        serverExpense({ id: "e2", amountKrw: 140_000, categoryId: SERVER_SEED_CATEGORY })
      ],
      selectedCategory: { id: DIAPER, label: "기저귀" }
    });
    // 월 합계는 정확하다(합산 규칙은 categoryId를 보지 않는다).
    expect(line?.text).toBe("8월 지금까지 200,000원");
    // "기저귀 60,000원"이라고 말했다면 실제보다 작은 숫자를 사실처럼 내놓는 것이다.
    expect(line?.text).not.toContain("기저귀");
  });

  it("로컬 대기 행이 8타일 밖 분류여도 같은 판정을 받는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 60_000, categoryId: DIAPER })],
      offlineRows: [offlineRow({ localId: "l1", amountKrw: 8_000, categoryId: SERVER_SEED_CATEGORY })],
      selectedCategory: { id: DIAPER, label: "기저귀" }
    });
    expect(line?.text).toBe("8월 지금까지 68,000원");
  });

  it("합계에서 이미 빠지는 행(선물)의 분류는 판정에 끼어들지 않는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [
        serverExpense({ id: "e1", amountKrw: 60_000, categoryId: DIAPER }),
        serverExpense({ id: "e2", amountKrw: 80_000, categoryId: SERVER_SEED_CATEGORY, expenseType: "gift" })
      ],
      selectedCategory: { id: DIAPER, label: "기저귀" }
    });
    expect(line?.text).toBe("8월 지금까지 60,000원 · 기저귀 60,000원");
  });

  it("분류가 아직 없는 행(빈 categoryId)은 어느 타일 합계도 갉지 않으므로 그대로 말한다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [
        serverExpense({ id: "e1", amountKrw: 60_000, categoryId: DIAPER }),
        serverExpense({ id: "e2", amountKrw: 40_000, categoryId: "" })
      ],
      selectedCategory: { id: DIAPER, label: "기저귀" }
    });
    expect(line?.text).toBe("8월 지금까지 100,000원 · 기저귀 60,000원");
  });

  it("순수 타일 행만 있는 달은 종전대로 카테고리 항을 말한다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [
        serverExpense({ id: "e1", amountKrw: 60_000, categoryId: DIAPER }),
        serverExpense({ id: "e2", amountKrw: 40_000, categoryId: CLOTHES })
      ],
      selectedCategory: { id: DIAPER, label: "기저귀" }
    });
    expect(line?.text).toBe("8월 지금까지 100,000원 · 기저귀 60,000원");
  });
});

/**
 * 라운드 38 H-11 — G-4의 생략 범위를 좁힌다.
 *
 * 서버 시드 UUID라고 해서 분류를 모르는 것은 아니다. 화면이 이미 들고 있는 `["categories"]`
 * 캐시가 `id -> code`를 알려 주므로, 공용 매핑을 넘겨 주면 임포트·수정 행도 제 타일에 정상
 * 합산된다. 생략은 **끝내 매핑되지 않는 행이 남을 때만** 한다.
 */
describe("buildEntryContextLine — H-11: 매핑을 받으면 임포트 행도 합산한다", () => {
  const SERVER_DIAPER = "8f2a1c40-7d3e-4b91-9a55-0f1c2d3e4b5a";
  const SERVER_SLEEP = "8f2a1c40-7d3e-4b91-9a55-0f1c2d3e4b5b";
  const resolveTileCategory = buildTileCategoryResolver([
    { id: SERVER_DIAPER, code: "diaper_hygiene" },
    // 8타일에 대응이 없는 정식 분류 -- 매핑해도 갈 곳이 없다.
    { id: SERVER_SLEEP, code: "sleep_furniture" }
  ]);

  it("매핑되는 임포트 행은 같은 타일 합계에 정상적으로 더해진다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [
        serverExpense({ id: "e1", amountKrw: 60_000, categoryId: DIAPER }),
        serverExpense({ id: "e2", amountKrw: 140_000, categoryId: SERVER_DIAPER })
      ],
      selectedCategory: { id: DIAPER, label: "기저귀" },
      resolveTileCategory
    });
    // 매핑 전에는 이 달의 카테고리 항이 통째로 사라졌다(G-4).
    expect(line?.text).toBe("8월 지금까지 200,000원 · 기저귀 200,000원");
  });

  it("로컬 대기 행의 서버 시드 분류도 같은 매핑을 통과한다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 60_000, categoryId: DIAPER })],
      offlineRows: [offlineRow({ localId: "l1", amountKrw: 8_000, categoryId: SERVER_DIAPER })],
      selectedCategory: { id: DIAPER, label: "기저귀" },
      resolveTileCategory
    });
    expect(line?.text).toBe("8월 지금까지 68,000원 · 기저귀 68,000원");
  });

  it("매핑 불가 행이 하나라도 남으면 종전대로 카테고리 항을 생략한다 (모르면 말하지 않는다)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [
        serverExpense({ id: "e1", amountKrw: 60_000, categoryId: DIAPER }),
        serverExpense({ id: "e2", amountKrw: 140_000, categoryId: SERVER_DIAPER }),
        // 수면/가구: 이 화면에 대응 타일이 없어 어느 타일 합계에도 넣을 수 없다.
        serverExpense({ id: "e3", amountKrw: 300_000, categoryId: SERVER_SLEEP })
      ],
      selectedCategory: { id: DIAPER, label: "기저귀" },
      resolveTileCategory
    });
    expect(line?.text).toBe("8월 지금까지 500,000원");
    expect(line?.text).not.toContain("기저귀");
  });

  it("다른 타일로 매핑된 행은 선택 타일의 합계를 부풀리지 않는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [
        serverExpense({ id: "e1", amountKrw: 60_000, categoryId: DIAPER }),
        serverExpense({ id: "e2", amountKrw: 40_000, categoryId: CLOTHES })
      ],
      selectedCategory: { id: DIAPER, label: "기저귀" },
      resolveTileCategory
    });
    expect(line?.text).toBe("8월 지금까지 100,000원 · 기저귀 60,000원");
  });

  it("매핑을 넘기지 않으면 라운드 37 G-4의 동작 그대로다", () => {
    const cachedMonthExpenses = [
      serverExpense({ id: "e1", amountKrw: 60_000, categoryId: DIAPER }),
      serverExpense({ id: "e2", amountKrw: 140_000, categoryId: SERVER_DIAPER })
    ];
    expect(
      buildEntryContextLine({
        ...baseInput,
        cachedMonthExpenses,
        selectedCategory: { id: DIAPER, label: "기저귀" }
      })?.text
    ).toBe("8월 지금까지 200,000원");
  });
});

/**
 * 라운드 39 I-1 — 서버 code 하나에 타일이 둘 걸린 분류(`feeding_babyfood` = "분유/유제품" · "식비")는
 * **합계를 말할 수 없는 달**을 만든다.
 *
 * 매핑은 그런 행을 결정적으로 첫 타일로 보내는데, 그 선택에는 근거가 없다. 그대로 두면 화면이
 * "식비 30,000원"처럼 실제와 다른 숫자를 사실로 적는다(분유 행이 식비에서 빠지거나, 그 반대).
 * 그래서 이 경로는 매핑 실패와 똑같이 다뤄 카테고리 항을 통째로 생략한다(G-4의 정직한 침묵).
 */
describe("buildEntryContextLine — I-1: 타일이 둘 걸린 code는 모르는 분류다", () => {
  const FOOD = "c0a7e901-0000-4c03-8c03-c47e900ec003"; // "식비" 타일
  const FORMULA = "c0a7e901-0000-4c02-8c02-c47e900ec002"; // "분유/유제품" 타일
  const SERVER_FEEDING = "8f2a1c40-7d3e-4b91-9a55-0f1c2d3e4bcc";
  const SERVER_DIAPER = "8f2a1c40-7d3e-4b91-9a55-0f1c2d3e4b5a";
  const resolveTileCategory = buildTileCategoryResolver([
    { id: SERVER_FEEDING, code: "feeding_babyfood" },
    { id: SERVER_DIAPER, code: "diaper_hygiene" }
  ]);

  it("서버 시드 수유/이유식 행이 섞이면 카테고리 항을 생략한다 (틀린 식비 합계를 적지 않는다)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [
        serverExpense({ id: "e1", amountKrw: 30_000, categoryId: FOOD }),
        serverExpense({ id: "e2", amountKrw: 20_000, categoryId: SERVER_FEEDING })
      ],
      selectedCategory: { id: FOOD, label: "식비" },
      resolveTileCategory
    });
    expect(line?.text).toBe("8월 지금까지 50,000원");
    expect(line?.text).not.toContain("식비");
  });

  it("분유/유제품 타일을 골라도 마찬가지다 (첫 타일이라고 사실이 되지는 않는다)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [
        serverExpense({ id: "e1", amountKrw: 30_000, categoryId: FORMULA }),
        serverExpense({ id: "e2", amountKrw: 20_000, categoryId: SERVER_FEEDING })
      ],
      selectedCategory: { id: FORMULA, label: "분유/유제품" },
      resolveTileCategory
    });
    expect(line?.text).toBe("8월 지금까지 50,000원");
  });

  it("로컬 대기 행의 모호한 분류도 같은 판정을 받는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 30_000, categoryId: FOOD })],
      offlineRows: [offlineRow({ localId: "l1", amountKrw: 8_000, categoryId: SERVER_FEEDING })],
      selectedCategory: { id: FOOD, label: "식비" },
      resolveTileCategory
    });
    expect(line?.text).toBe("8월 지금까지 38,000원");
  });

  it("1:1 code(기저귀 등)만 있는 달은 종전대로 정상 합산한다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [
        serverExpense({ id: "e1", amountKrw: 60_000, categoryId: DIAPER }),
        serverExpense({ id: "e2", amountKrw: 40_000, categoryId: SERVER_DIAPER })
      ],
      selectedCategory: { id: DIAPER, label: "기저귀" },
      resolveTileCategory
    });
    expect(line?.text).toBe("8월 지금까지 100,000원 · 기저귀 100,000원");
  });

  it("두 타일의 id로 직접 기록된 행끼리는 모호하지 않다 (타일 id는 code를 거치지 않는다)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cachedMonthExpenses: [
        serverExpense({ id: "e1", amountKrw: 30_000, categoryId: FOOD }),
        serverExpense({ id: "e2", amountKrw: 20_000, categoryId: FORMULA })
      ],
      selectedCategory: { id: FOOD, label: "식비" },
      resolveTileCategory
    });
    expect(line?.text).toBe("8월 지금까지 50,000원 · 식비 30,000원");
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

/**
 * 라운드 85 A — 기록 날짜가 **지난달**이면 그 달의 합계를 말한다.
 *
 * 이 화면은 GAP-058 #6 이후 지난달 캐시를 이미 손에 들고 있다(자동완성·판매처 칩의 모집단).
 * 그 캐시가 있으면 달 경계에서 침묵할 이유가 없다 — 침묵의 근거였던 *"이 화면이 가진 캐시는
 * 이번 달 한 달치뿐"* 이 오늘 거짓이기 때문이다(아래 머리말 계약이 그 문장의 부재를 문다).
 */
describe("buildEntryContextLine — 라운드 85 A: 지난달 갈래", () => {
  const previousArgs = {
    cacheYearMonth: "2026-08",
    entryYearMonth: "2026-07",
    previousYearMonth: "2026-07"
  };

  it("지난달 날짜로 기록하는 중이면 지난달 합계를 말한다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      ...previousArgs,
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })],
      previousMonthExpenses: [
        serverExpense({ id: "p1", amountKrw: 90_000 }),
        serverExpense({ id: "p2", amountKrw: 10_000, categoryId: CLOTHES })
      ]
    });
    expect(line?.text).toBe("7월에는 100,000원 썼어요");
    expect(line?.accessibilityLabel).toBe("7월에는 100,000원 썼어요");
  });

  it("끝난 달에는 '지금까지'라고 말하지 않는다 (진행 중인 달의 낱말이다)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      ...previousArgs,
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })],
      previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 100_000 })],
      selectedCategory: { id: DIAPER, label: "기저귀" }
    });
    expect(line?.text).not.toContain("지금까지");
    expect(line?.accessibilityLabel).not.toContain("지금까지");
  });

  it("이번 달 합계를 지난달 이름으로 말하지 않는다 (두 숫자가 섞이지 않는다)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      ...previousArgs,
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })],
      previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 100_000 })]
    });
    expect(line?.text).not.toContain("1,200,000");
    expect(line?.text).not.toContain("8월");
  });

  it("지난달 캐시가 없으면(콜드 스타트) 종전대로 침묵한다", () => {
    const withoutCache = {
      ...baseInput,
      ...previousArgs,
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })]
    };
    expect(buildEntryContextLine({ ...withoutCache, previousMonthExpenses: undefined })).toBeNull();
    expect(buildEntryContextLine({ ...withoutCache, previousMonthExpenses: null })).toBeNull();
  });

  it("지난달 캐시가 비어 있거나 전부 선물이면 말할 숫자가 없어 줄을 그리지 않는다", () => {
    expect(
      buildEntryContextLine({
        ...baseInput,
        ...previousArgs,
        cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })],
        previousMonthExpenses: []
      })
    ).toBeNull();
    expect(
      buildEntryContextLine({
        ...baseInput,
        ...previousArgs,
        cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })],
        previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 80_000, expenseType: "gift" })]
      })
    ).toBeNull();
  });

  it("두 달 밖의 달(더 과거·미래)은 손에 든 캐시가 없으므로 여전히 침묵한다", () => {
    const twoMonthsAgo = buildEntryContextLine({
      ...baseInput,
      ...previousArgs,
      entryYearMonth: "2026-06",
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })],
      previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 100_000 })]
    });
    expect(twoMonthsAgo).toBeNull();
    const nextMonth = buildEntryContextLine({
      ...baseInput,
      ...previousArgs,
      entryYearMonth: "2026-09",
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })],
      previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 100_000 })]
    });
    expect(nextMonth).toBeNull();
  });

  it("지난달 달 문자열이 깨져 있으면 아무 말도 하지 않는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cacheYearMonth: "2026-08",
      entryYearMonth: "2026-7",
      previousYearMonth: "2026-7",
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })],
      previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 100_000 })]
    });
    expect(line).toBeNull();
  });

  it("이번 달을 적는 중이면 지난달 인자를 넘겨도 이번 달 줄 그대로다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      cacheYearMonth: "2026-08",
      entryYearMonth: "2026-08",
      previousYearMonth: "2026-07",
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })],
      previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 100_000 })]
    });
    expect(line?.text).toBe("8월 지금까지 1,200,000원");
  });

  it("지난달 인자를 넘기지 않으면 종전대로 침묵한다 (폴백)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      entryYearMonth: "2026-07",
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 100_000 })]
    });
    expect(line).toBeNull();
  });

  /**
   * ⚠️ **라운드 85 리뷰 L-12 — `previousYearMonth`가 정말 '지난달'인지 확인하지 않았다.**
   *
   * 이 갈래는 `entryYearMonth === previousYearMonth`만 보고 **끝난 달의 낱말**("…에는 … 썼어요")을
   * 쓴다. 그런데 호출부가 넘기는 값이 이번 달보다 **뒤**인 달이면(달 경계 계산이 뒤집히거나 캐시
   * 키가 어긋나는 날) 화면은 아직 오지 않은 달을 **끝난 달처럼** 말하게 된다 — 이 모듈이
   * 처음부터 막던 종류의 허위 표시다(콜드 스타트를 "0원 썼어요"로 말하지 않는 것과 같은 축).
   * 순서를 한 줄로 확인하고, 아니면 다른 어긋난 달과 똑같이 **침묵한다**.
   */
  it("L-12: 이번 달보다 뒤인 달을 '지난달'로 넘기면 말하지 않는다 (미래를 끝난 달로 말하지 않는다)", () => {
    const future = buildEntryContextLine({
      ...baseInput,
      cacheYearMonth: "2026-08",
      entryYearMonth: "2026-09",
      previousYearMonth: "2026-09",
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })],
      previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 100_000 })]
    });
    expect(future).toBeNull();

    // 해가 바뀌는 자리에서도 순서로 판정한다(12월 캐시에 다음 해 1월을 넘기는 경우).
    expect(
      buildEntryContextLine({
        ...baseInput,
        cacheYearMonth: "2026-12",
        entryYearMonth: "2027-01",
        previousYearMonth: "2027-01",
        cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })],
        previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 100_000 })]
      })
    ).toBeNull();

    // 반대 방향(진짜 지난달)은 해 경계에서도 그대로 말한다 — 방어가 정상 갈래를 먹지 않는다.
    const acrossYear = buildEntryContextLine({
      ...baseInput,
      cacheYearMonth: "2027-01",
      entryYearMonth: "2026-12",
      previousYearMonth: "2026-12",
      cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })],
      previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 100_000 })]
    });
    expect(acrossYear?.text).toBe("12월에는 100,000원 썼어요");
  });
});

/**
 * 라운드 85 A — 지난달 갈래의 합계도 **같은 한 벌의 규칙**을 지난다(reconcileMonthlyExpenses).
 * 여기서 손으로 더하는 합계가 생기면 같은 달을 두고 이 줄과 기록 탭이 다른 숫자를 말하게 된다.
 */
describe("buildEntryContextLine — 라운드 85 A: 지난달 합계 정합", () => {
  const previousArgs = {
    cacheYearMonth: "2026-08",
    entryYearMonth: "2026-07",
    previousYearMonth: "2026-07",
    cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000 })]
  };

  it("지난달의 로컬 대기 행을 더한다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      ...previousArgs,
      previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 100_000 })],
      offlineRows: [offlineRow({ localId: "l1", amountKrw: 7_000, spentOn: "2026-07-15" })]
    });
    expect(line?.text).toBe("7월에는 107,000원 썼어요");
  });

  it("이번 달의 로컬 대기 행은 지난달 합계로 새지 않는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      ...previousArgs,
      previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 100_000 })],
      offlineRows: [offlineRow({ localId: "l1", amountKrw: 50_000, spentOn: "2026-08-03" })]
    });
    expect(line?.text).toBe("7월에는 100,000원 썼어요");
  });

  it("지난달 선물·환불은 합계에서 빠진다 (DNC-015, 같은 술어)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      ...previousArgs,
      previousMonthExpenses: [
        serverExpense({ id: "p1", amountKrw: 100_000 }),
        serverExpense({ id: "p2", amountKrw: 80_000, expenseType: "gift" }),
        serverExpense({ id: "p3", amountKrw: 30_000, expenseType: "refund" })
      ]
    });
    expect(line?.text).toBe("7월에는 100,000원 썼어요");
  });

  it("로컬 수정이 걸린 낡은 지난달 서버 행은 두 번 세지 않는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      ...previousArgs,
      previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 100_000 })],
      offlineRows: [
        offlineRow({ localId: "l1", canonicalId: "p1", amountKrw: 120_000, spentOn: "2026-07-20" })
      ]
    });
    expect(line?.text).toBe("7월에는 120,000원 썼어요");
  });

  it("다른 아이의 지난달 로컬 행은 더하지 않는다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      ...previousArgs,
      previousMonthExpenses: [serverExpense({ id: "p1", amountKrw: 100_000 })],
      offlineRows: [
        offlineRow({ localId: "l1", childId: "child-2", amountKrw: 999_000, spentOn: "2026-07-09" })
      ]
    });
    expect(line?.text).toBe("7월에는 100,000원 썼어요");
  });
});

/**
 * 라운드 85 A — 카테고리 항의 판정(G-4·H-11·I-1)은 **한 글자도 바뀌지 않는다**. 지난달 갈래도
 * 같은 술어를 지나고, 낭독 라벨의 가운뎃점 → 쉼표 관례도 종전 그대로다.
 */
describe("buildEntryContextLine — 라운드 85 A: 지난달의 카테고리 항", () => {
  const previousArgs = {
    cacheYearMonth: "2026-08",
    entryYearMonth: "2026-07",
    previousYearMonth: "2026-07",
    cachedMonthExpenses: [serverExpense({ id: "e1", amountKrw: 1_200_000, categoryId: DIAPER })]
  };
  const SERVER_SLEEP = "8f2a1c40-7d3e-4b91-9a55-0f1c2d3e4b5b";

  it("선택된 타일의 지난달 합계를 뒤에 붙이고, 낭독에는 쉼표로 끊어 읽힌다", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      ...previousArgs,
      previousMonthExpenses: [
        serverExpense({ id: "p1", amountKrw: 60_000, categoryId: DIAPER }),
        serverExpense({ id: "p2", amountKrw: 40_000, categoryId: CLOTHES })
      ],
      offlineRows: [offlineRow({ localId: "l1", amountKrw: 8_000, categoryId: DIAPER, spentOn: "2026-07-02" })],
      selectedCategory: { id: DIAPER, label: "기저귀" }
    });
    expect(line?.text).toBe("7월에는 108,000원 썼어요 · 기저귀 68,000원");
    expect(line?.accessibilityLabel).toBe("7월에는 108,000원 썼어요, 기저귀 68,000원");
  });

  it("옮길 곳 없는 분류가 지난달에 섞여 있으면 카테고리 항을 생략한다 (G-4 무접촉)", () => {
    const line = buildEntryContextLine({
      ...baseInput,
      ...previousArgs,
      previousMonthExpenses: [
        serverExpense({ id: "p1", amountKrw: 60_000, categoryId: DIAPER }),
        serverExpense({ id: "p2", amountKrw: 140_000, categoryId: SERVER_SLEEP })
      ],
      selectedCategory: { id: DIAPER, label: "기저귀" }
    });
    expect(line?.text).toBe("7월에는 200,000원 썼어요");
    expect(line?.text).not.toContain("기저귀");
  });

  it("매핑을 넘기면 지난달의 서버 시드 행도 제 타일에 합산된다 (H-11 무접촉)", () => {
    const SERVER_DIAPER = "8f2a1c40-7d3e-4b91-9a55-0f1c2d3e4b5a";
    const line = buildEntryContextLine({
      ...baseInput,
      ...previousArgs,
      previousMonthExpenses: [
        serverExpense({ id: "p1", amountKrw: 60_000, categoryId: DIAPER }),
        serverExpense({ id: "p2", amountKrw: 140_000, categoryId: SERVER_DIAPER })
      ],
      selectedCategory: { id: DIAPER, label: "기저귀" },
      resolveTileCategory: buildTileCategoryResolver([{ id: SERVER_DIAPER, code: "diaper_hygiene" }])
    });
    expect(line?.text).toBe("7월에는 200,000원 썼어요 · 기저귀 200,000원");
  });
});

/**
 * 라운드 85 A ⓔ — **거짓이 된 근거가 다시 근거로 쓰이지 않게 한다.**
 *
 * 이 줄의 달 경계 침묵은 *"이 화면이 가진 캐시는 이번 달 한 달치뿐"* 이라는 문장을 이유로
 * 적어 두었고, 그 문장은 GAP-058 #6(지난달 캐시) 이후 거짓이다. 문장이 소스에 남아 있으면
 * 다음 라운드가 같은 인용으로 같은 침묵을 다시 옳다고 읽는다.
 */
describe("머리말 계약 (src/expenses/entry-context-line.ts)", () => {
  const moduleSource = readFileSync(join(process.cwd(), "src/expenses/entry-context-line.ts"), "utf8");

  it("거짓이 된 전제('이번 달 한 달치뿐')가 소스에 남아 있지 않다", () => {
    expect(moduleSource).not.toContain("이번 달 한 달치뿐");
  });

  it("두 달 모집단의 출처와 상한이 머리말에 적혀 있다", () => {
    expect(moduleSource).toContain("라운드 85 A");
    expect(moduleSource).toContain("두 달보다 넓히지 않는다");
  });
});

/**
 * 화면 배선 계약(source verification) — react-native 화면은 vitest에서 렌더할 수 없어 이 저장소의
 * 관례대로 소스 grep으로 확인한다(record-row-actions.test.ts와 같은 관례).
 */
describe("H-11 배선 계약 (app/expenses/new.tsx)", () => {
  const newExpenseSource = readFileSync(join(process.cwd(), "app/expenses/new.tsx"), "utf8");

  it("매핑은 이미 받아 둔 캐시만 읽어 만든다 — 이 화면은 새 요청을 하지 않는다", () => {
    expect(newExpenseSource).toContain('from "../../src/categories"');
    expect(newExpenseSource).toContain('queryClient.getQueryData<{ categories: CategoryListItem[] }>(["categories"])');
    // useQuery로 바꾸면 시트를 여는 것만으로 요청이 하나 늘어난다(UX-C의 규칙).
    expect(newExpenseSource).not.toContain('queryKey: ["categories"]');
  });

  it("맥락 한 줄이 그 매핑을 그대로 받는다", () => {
    expect(newExpenseSource).toContain("resolveTileCategory\n  });");
  });

  it("라운드 85 A: 지난달 캐시는 화면이 이미 읽어 둔 값을 그대로 넘긴다 — 새 요청·새 키 0건", () => {
    // 원천은 자동완성·판매처 칩이 이미 읽는 그 캐시 하나뿐이다(getQueryData).
    expect(newExpenseSource).toContain(
      'queryClient.getQueryData<MonthExpenses>(["expenses", childId, previousMonth])'
    );
    expect(newExpenseSource).toContain("previousMonthExpenses: cachedPreviousMonthExpenses");
    expect(newExpenseSource).toContain("previousYearMonth: previousMonth");
    // useQuery로 바꾸면 시트를 여는 것만으로 요청이 하나 늘어난다(UX-C의 규칙).
    expect(newExpenseSource).not.toContain('queryKey: ["expenses", childId');
  });
});
