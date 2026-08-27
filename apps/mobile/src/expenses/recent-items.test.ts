import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRecentItemChips,
  formatRecentItemChipLabel,
  recentItemChipAccessibilityLabel,
  RECENT_ITEM_CHIP_LIMIT,
  type RecentItemServerRow,
  type RecentItemSourceRow
} from "./recent-items";

const CHILD_ID = "child-1";

function row(overrides: {
  itemName: string;
  amountKrw?: number;
  categoryId?: string;
  createdAt: string;
  childId?: string;
  pendingDelete?: boolean;
  expenseType?: string;
}): RecentItemSourceRow {
  return {
    childId: overrides.childId ?? CHILD_ID,
    pendingDelete: overrides.pendingDelete ?? false,
    createdAt: overrides.createdAt,
    payload: {
      itemName: overrides.itemName,
      amountKrw: overrides.amountKrw ?? 10000,
      categoryId: overrides.categoryId ?? "cat-diaper",
      ...(overrides.expenseType !== undefined ? { expenseType: overrides.expenseType } : {})
    }
  };
}

describe("buildRecentItemChips (EXP-113)", () => {
  it("returns the newest entries first, regardless of input order", () => {
    const chips = buildRecentItemChips(
      [
        row({ itemName: "물티슈", createdAt: "2026-08-01T09:00:00.000Z" }),
        row({ itemName: "분유", createdAt: "2026-08-03T09:00:00.000Z" }),
        row({ itemName: "기저귀", createdAt: "2026-08-02T09:00:00.000Z" })
      ],
      CHILD_ID
    );

    expect(chips.map((chip) => chip.itemName)).toEqual(["분유", "기저귀", "물티슈"]);
  });

  it("keeps only the newest entry per item name (dedupe by trimmed name)", () => {
    const chips = buildRecentItemChips(
      [
        row({ itemName: "기저귀", amountKrw: 30000, createdAt: "2026-08-01T09:00:00.000Z" }),
        row({ itemName: "기저귀 ", amountKrw: 38500, categoryId: "cat-diaper-new", createdAt: "2026-08-05T09:00:00.000Z" }),
        row({ itemName: "분유", amountKrw: 42000, createdAt: "2026-08-02T09:00:00.000Z" })
      ],
      CHILD_ID
    );

    expect(chips).toEqual([
      { itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper-new" },
      { itemName: "분유", amountKrw: 42000, categoryId: "cat-diaper" }
    ]);
  });

  it("caps the list at 5 chips by default", () => {
    const rows = Array.from({ length: 8 }, (_, index) =>
      row({ itemName: `품목-${index}`, createdAt: `2026-08-0${index + 1}T09:00:00.000Z` })
    );

    const chips = buildRecentItemChips(rows, CHILD_ID);

    expect(RECENT_ITEM_CHIP_LIMIT).toBe(5);
    expect(chips).toHaveLength(5);
    expect(chips[0]!.itemName).toBe("품목-7");
  });

  it("dedupes before applying the cap, so 5 distinct items survive heavy repeats", () => {
    const rows = [
      // 같은 품목("기저귀")을 여러 번 반복 입력해도 칩 자리는 1개만 차지해야 한다.
      row({ itemName: "기저귀", createdAt: "2026-08-10T09:00:00.000Z" }),
      row({ itemName: "기저귀", createdAt: "2026-08-09T09:00:00.000Z" }),
      row({ itemName: "기저귀", createdAt: "2026-08-08T09:00:00.000Z" }),
      row({ itemName: "분유", createdAt: "2026-08-07T09:00:00.000Z" }),
      row({ itemName: "물티슈", createdAt: "2026-08-06T09:00:00.000Z" }),
      row({ itemName: "내복", createdAt: "2026-08-05T09:00:00.000Z" }),
      row({ itemName: "손수건", createdAt: "2026-08-04T09:00:00.000Z" })
    ];

    const chips = buildRecentItemChips(rows, CHILD_ID);

    expect(chips.map((chip) => chip.itemName)).toEqual(["기저귀", "분유", "물티슈", "내복", "손수건"]);
  });

  it("only includes rows for the selected child", () => {
    const chips = buildRecentItemChips(
      [
        row({ itemName: "기저귀", createdAt: "2026-08-02T09:00:00.000Z" }),
        row({ itemName: "다른아이 분유", childId: "child-2", createdAt: "2026-08-03T09:00:00.000Z" })
      ],
      CHILD_ID
    );

    expect(chips.map((chip) => chip.itemName)).toEqual(["기저귀"]);
  });

  it("skips pending-delete rows and rows with blank names or non-positive/non-integer amounts", () => {
    const chips = buildRecentItemChips(
      [
        row({ itemName: "삭제 대기", pendingDelete: true, createdAt: "2026-08-05T09:00:00.000Z" }),
        row({ itemName: "   ", createdAt: "2026-08-04T09:00:00.000Z" }),
        row({ itemName: "0원", amountKrw: 0, createdAt: "2026-08-03T09:00:00.000Z" }),
        row({ itemName: "소수점", amountKrw: 1000.5, createdAt: "2026-08-02T09:00:00.000Z" }),
        row({ itemName: "기저귀", amountKrw: 38500, createdAt: "2026-08-01T09:00:00.000Z" })
      ],
      CHILD_ID
    );

    expect(chips.map((chip) => chip.itemName)).toEqual(["기저귀"]);
  });

  it("excludes non-expense rows (gift/refund) so tapping a chip never re-enters them as a plain expense", () => {
    const chips = buildRecentItemChips(
      [
        row({ itemName: "돌잔치 선물 아기띠", expenseType: "gift", createdAt: "2026-08-05T09:00:00.000Z" }),
        row({ itemName: "환불된 젖병", expenseType: "refund", createdAt: "2026-08-04T09:00:00.000Z" }),
        row({ itemName: "기저귀", expenseType: "expense", createdAt: "2026-08-03T09:00:00.000Z" })
      ],
      CHILD_ID
    );

    expect(chips.map((chip) => chip.itemName)).toEqual(["기저귀"]);
  });

  it("treats legacy payloads without expenseType as plain expenses", () => {
    const chips = buildRecentItemChips(
      [
        // 레거시 행: payload에 expenseType 필드가 아예 없다.
        row({ itemName: "물티슈", createdAt: "2026-08-02T09:00:00.000Z" }),
        row({ itemName: "선물 내복", expenseType: "gift", createdAt: "2026-08-03T09:00:00.000Z" })
      ],
      CHILD_ID
    );

    expect(chips.map((chip) => chip.itemName)).toEqual(["물티슈"]);
  });

  it("does not let an excluded gift row shadow an older expense row with the same item name", () => {
    const chips = buildRecentItemChips(
      [
        row({ itemName: "기저귀", amountKrw: 55000, expenseType: "gift", createdAt: "2026-08-09T09:00:00.000Z" }),
        row({ itemName: "기저귀", amountKrw: 38500, expenseType: "expense", createdAt: "2026-08-01T09:00:00.000Z" })
      ],
      CHILD_ID
    );

    expect(chips).toEqual([{ itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper" }]);
  });

  it("returns an empty list for no rows (chips section simply hides)", () => {
    expect(buildRecentItemChips([], CHILD_ID)).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const rows = [
      row({ itemName: "물티슈", createdAt: "2026-08-01T09:00:00.000Z" }),
      row({ itemName: "분유", createdAt: "2026-08-03T09:00:00.000Z" })
    ];
    const before = [...rows];

    buildRecentItemChips(rows, CHILD_ID);

    expect(rows).toEqual(before);
  });
});

describe("UX-L(B) 서버 월 캐시 폴백", () => {
  function serverRow(overrides: {
    itemName: string;
    amountKrw?: number;
    categoryId?: string;
    spentOn: string;
    expenseType?: string;
  }): RecentItemServerRow {
    return {
      itemName: overrides.itemName,
      amountKrw: overrides.amountKrw ?? 10000,
      categoryId: overrides.categoryId ?? "cat-diaper",
      spentOn: overrides.spentOn,
      ...(overrides.expenseType !== undefined ? { expenseType: overrides.expenseType } : {})
    };
  }

  const serverRows = [
    serverRow({ itemName: "분유", amountKrw: 42000, spentOn: "2026-08-20" }),
    serverRow({ itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper-new", spentOn: "2026-08-24" }),
    serverRow({ itemName: "물티슈", amountKrw: 9900, spentOn: "2026-08-11" })
  ];

  it("로컬 스냅숏이 비면 서버 월 캐시에서 같은 규칙으로 칩을 만든다 (재설치·기종 변경·두 번째 기기)", () => {
    const chips = buildRecentItemChips([], CHILD_ID, { serverRows });

    // spentOn 내림차순.
    expect(chips).toEqual([
      { itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper-new" },
      { itemName: "분유", amountKrw: 42000, categoryId: "cat-diaper" },
      { itemName: "물티슈", amountKrw: 9900, categoryId: "cat-diaper" }
    ]);
  });

  it("로컬에서 칩이 하나라도 나오면 서버 행은 보지 않는다 (우선순위 로컬)", () => {
    const chips = buildRecentItemChips([row({ itemName: "젖병", createdAt: "2026-08-02T09:00:00.000Z" })], CHILD_ID, {
      serverRows
    });

    expect(chips).toEqual([{ itemName: "젖병", amountKrw: 10000, categoryId: "cat-diaper" }]);
  });

  it("서버 행을 넘기지 않거나 비어 있으면 예전 동작 그대로다", () => {
    expect(buildRecentItemChips([], CHILD_ID)).toEqual([]);
    expect(buildRecentItemChips([], CHILD_ID, {})).toEqual([]);
    expect(buildRecentItemChips([], CHILD_ID, { serverRows: [] })).toEqual([]);
  });

  it("다른 아이의 로컬 행만 있는 경우에도 폴백한다 (그 아이 기준으로는 이력이 없다)", () => {
    const otherChildRows = [row({ itemName: "젖병", childId: "child-2", createdAt: "2026-08-02T09:00:00.000Z" })];

    expect(buildRecentItemChips(otherChildRows, CHILD_ID, { serverRows }).map((chip) => chip.itemName)).toEqual([
      "기저귀",
      "분유",
      "물티슈"
    ]);
  });

  it("선물·환불, 빈 품목명, 유효하지 않은 금액은 로컬과 같은 규칙으로 뺀다", () => {
    const chips = buildRecentItemChips([], CHILD_ID, {
      serverRows: [
        serverRow({ itemName: "선물받은 옷", spentOn: "2026-08-25", expenseType: "gift" }),
        serverRow({ itemName: "환불건", spentOn: "2026-08-24", expenseType: "refund" }),
        serverRow({ itemName: "   ", spentOn: "2026-08-23" }),
        serverRow({ itemName: "소수금액", amountKrw: 1000.5, spentOn: "2026-08-22" }),
        serverRow({ itemName: "0원", amountKrw: 0, spentOn: "2026-08-21" }),
        serverRow({ itemName: "기저귀", amountKrw: 38500, spentOn: "2026-08-20" })
      ]
    });

    expect(chips).toEqual([{ itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper" }]);
  });

  it("품목명 중복은 최신(spentOn) 1개만 남기고 상한까지만 준다", () => {
    const chips = buildRecentItemChips([], CHILD_ID, {
      serverRows: [
        serverRow({ itemName: "기저귀", amountKrw: 30000, spentOn: "2026-08-01" }),
        serverRow({ itemName: "기저귀 ", amountKrw: 38500, spentOn: "2026-08-15" }),
        serverRow({ itemName: "분유", spentOn: "2026-08-14" }),
        serverRow({ itemName: "물티슈", spentOn: "2026-08-13" }),
        serverRow({ itemName: "젖병", spentOn: "2026-08-12" }),
        serverRow({ itemName: "손수건", spentOn: "2026-08-11" }),
        serverRow({ itemName: "속싸개", spentOn: "2026-08-10" })
      ]
    });

    expect(chips).toHaveLength(RECENT_ITEM_CHIP_LIMIT);
    expect(chips[0]).toEqual({ itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper" });
  });

  it("입력 배열을 건드리지 않는다", () => {
    const rows = [...serverRows];
    const before = [...rows];

    buildRecentItemChips([], CHILD_ID, { serverRows: rows });

    expect(rows).toEqual(before);
  });
});

describe("UX-L(B) 배선 계약 (app/expenses/new.tsx)", () => {
  it("폴백 원천은 자동완성이 이미 쓰는 서버 월 캐시다 (새 요청 없음)", () => {
    const newExpenseSource = readFileSync(join(process.cwd(), "app/expenses/new.tsx"), "utf8");

    expect(newExpenseSource).toContain("buildRecentItemChips(offlineSnapshot.rows, childId, { serverRows: expenseHistory })");
    // expenseHistory는 useQuery가 아니라 getQueryData로 읽은 **이미 받아 둔** 캐시다.
    expect(newExpenseSource).toContain("queryClient.getQueryData<MonthExpenses>([\"expenses\", childId, currentYearMonth])?.expenses");
  });
});

describe("recent item chip labels", () => {
  const chip = { itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper" };

  it("formats the visible label with a ko-KR grouped amount", () => {
    expect(formatRecentItemChipLabel(chip)).toBe("기저귀 · 38,500원");
  });

  it("formats the screen-reader label as 최근 항목 ... 다시 입력", () => {
    expect(recentItemChipAccessibilityLabel(chip)).toBe("최근 항목 기저귀 38,500원 다시 입력");
  });
});
