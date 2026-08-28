import { describe, expect, it } from "vitest";
import {
  buildSuggestSourceRows,
  partitionSuggestSourceRows,
  type SuggestSourceLocalRow,
  type SuggestSourceServerRow
} from "./suggest-source";
import { buildItemAutocompleteSuggestions } from "./item-autocomplete";
import { buildMerchantSuggestions } from "./merchant-suggest";
import { buildRecentItemChips } from "./recent-items";

const CHILD_ID = "child-1";

function localRow(overrides: {
  itemName: string;
  amountKrw?: number;
  categoryId?: string;
  createdAt: string;
  spentOn?: string;
  merchant?: string | null;
  childId?: string;
  canonicalId?: string | null;
  pendingDelete?: boolean;
  expenseType?: string;
}): SuggestSourceLocalRow {
  return {
    childId: overrides.childId ?? CHILD_ID,
    pendingDelete: overrides.pendingDelete ?? false,
    createdAt: overrides.createdAt,
    ...(overrides.canonicalId !== undefined ? { canonicalId: overrides.canonicalId } : {}),
    payload: {
      itemName: overrides.itemName,
      amountKrw: overrides.amountKrw ?? 10000,
      categoryId: overrides.categoryId ?? "cat-diaper",
      ...(overrides.spentOn !== undefined ? { spentOn: overrides.spentOn } : {}),
      ...(overrides.merchant !== undefined ? { merchant: overrides.merchant } : {}),
      ...(overrides.expenseType !== undefined ? { expenseType: overrides.expenseType } : {})
    }
  };
}

function serverRow(overrides: {
  id?: string;
  itemName: string;
  amountKrw?: number;
  categoryId?: string;
  spentOn: string;
  merchant?: string | null;
  expenseType?: string;
}): SuggestSourceServerRow {
  return {
    ...(overrides.id !== undefined ? { id: overrides.id } : {}),
    itemName: overrides.itemName,
    amountKrw: overrides.amountKrw ?? 10000,
    categoryId: overrides.categoryId ?? "cat-diaper",
    spentOn: overrides.spentOn,
    ...(overrides.merchant !== undefined ? { merchant: overrides.merchant } : {}),
    ...(overrides.expenseType !== undefined ? { expenseType: overrides.expenseType } : {})
  };
}

function names(rows: { itemName: string }[]): string[] {
  return rows.map((row) => row.itemName);
}

describe("GAP-058 #6 통합 제안 원천 — 갈래 나누기", () => {
  it("로컬은 입력 시각(createdAt) 내림차순, 서버는 지출 날짜(spentOn) 내림차순이다", () => {
    const { local, server } = partitionSuggestSourceRows({
      childId: CHILD_ID,
      localRows: [
        localRow({ itemName: "물티슈", createdAt: "2026-09-01T09:00:00.000Z" }),
        localRow({ itemName: "분유", createdAt: "2026-09-03T09:00:00.000Z" })
      ],
      currentMonthRows: [
        serverRow({ id: "s1", itemName: "기저귀", spentOn: "2026-09-01" }),
        serverRow({ id: "s2", itemName: "젖병", spentOn: "2026-09-02" })
      ]
    });

    expect(names(local)).toEqual(["분유", "물티슈"]);
    expect(names(server)).toEqual(["젖병", "기저귀"]);
    expect(local.every((row) => row.origin === "local")).toBe(true);
    expect(server.every((row) => row.origin === "server")).toBe(true);
  });

  it("통합 목록은 로컬이 앞이다 — 같은 날짜에서 이 기기가 방금 적은 표기가 이긴다", () => {
    const rows = buildSuggestSourceRows({
      childId: CHILD_ID,
      localRows: [localRow({ itemName: "기저귀 대형", createdAt: "2026-09-10T09:00:00.000Z", spentOn: "2026-09-10" })],
      currentMonthRows: [serverRow({ id: "s1", itemName: "기저귀", spentOn: "2026-09-10" })]
    });

    expect(names(rows)).toEqual(["기저귀 대형", "기저귀"]);
  });

  it("선택된 아이의 행만 본다 (스냅숏에는 형제 행이 함께 들어 있다)", () => {
    const { local } = partitionSuggestSourceRows({
      childId: CHILD_ID,
      localRows: [
        localRow({ itemName: "첫째 기저귀", createdAt: "2026-09-02T09:00:00.000Z" }),
        localRow({ itemName: "둘째 분유", childId: "child-2", createdAt: "2026-09-03T09:00:00.000Z" })
      ]
    });

    expect(names(local)).toEqual(["첫째 기저귀"]);
  });

  it("선물·환불과 삭제 대기 행은 양쪽 원천에서 똑같이 뺀다 (레거시 행은 일반 지출)", () => {
    const { local, server } = partitionSuggestSourceRows({
      childId: CHILD_ID,
      localRows: [
        localRow({ itemName: "선물 아기띠", expenseType: "gift", createdAt: "2026-09-05T09:00:00.000Z" }),
        localRow({ itemName: "환불 젖병", expenseType: "refund", createdAt: "2026-09-04T09:00:00.000Z" }),
        localRow({ itemName: "삭제 대기", pendingDelete: true, createdAt: "2026-09-03T09:00:00.000Z" }),
        // 레거시 페이로드: expenseType 필드가 아예 없다.
        localRow({ itemName: "물티슈", createdAt: "2026-09-02T09:00:00.000Z" })
      ],
      currentMonthRows: [
        serverRow({ id: "s1", itemName: "선물받은 옷", spentOn: "2026-09-05", expenseType: "gift" }),
        serverRow({ id: "s2", itemName: "기저귀", spentOn: "2026-09-04", expenseType: "expense" })
      ]
    });

    expect(names(local)).toEqual(["물티슈"]);
    expect(names(server)).toEqual(["기저귀"]);
  });

  it("두 원천이 다 비면 빈 목록이다 (후보를 지어내지 않는다)", () => {
    expect(buildSuggestSourceRows({ childId: CHILD_ID })).toEqual([]);
    expect(buildSuggestSourceRows({ childId: CHILD_ID, localRows: [], currentMonthRows: [] })).toEqual([]);
    expect(
      buildSuggestSourceRows({ childId: CHILD_ID, localRows: null, currentMonthRows: null, previousMonthRows: null })
    ).toEqual([]);
  });

  it("입력 배열을 건드리지 않는다", () => {
    const localRows = [
      localRow({ itemName: "물티슈", createdAt: "2026-09-01T09:00:00.000Z" }),
      localRow({ itemName: "분유", createdAt: "2026-09-03T09:00:00.000Z" })
    ];
    const serverRows = [
      serverRow({ id: "s1", itemName: "기저귀", spentOn: "2026-09-01" }),
      serverRow({ id: "s2", itemName: "젖병", spentOn: "2026-09-02" })
    ];
    const localBefore = [...localRows];
    const serverBefore = [...serverRows];

    buildSuggestSourceRows({ childId: CHILD_ID, localRows, currentMonthRows: serverRows });

    expect(localRows).toEqual(localBefore);
    expect(serverRows).toEqual(serverBefore);
  });
});

describe("GAP-058 #6 중복 제거 — 로컬에 있으면 로컬만", () => {
  it("동기화가 끝난 행은 한 번만 센다 (canonicalId와 같은 id의 서버 행을 버린다)", () => {
    const rows = buildSuggestSourceRows({
      childId: CHILD_ID,
      localRows: [
        localRow({
          itemName: "기저귀",
          amountKrw: 38500,
          canonicalId: "exp-1",
          createdAt: "2026-09-10T09:00:00.000Z",
          spentOn: "2026-09-10",
          merchant: "쿠팡"
        })
      ],
      currentMonthRows: [
        // 위 로컬 행이 올라간 뒤 서버 목록에도 같은 지출이 있다.
        serverRow({ id: "exp-1", itemName: "기저귀", amountKrw: 38500, spentOn: "2026-09-10", merchant: "쿠팡" }),
        serverRow({ id: "exp-2", itemName: "분유", spentOn: "2026-09-09", merchant: "이마트" })
      ]
    });

    expect(names(rows)).toEqual(["기저귀", "분유"]);
    // 판매처 빈도가 부풀지 않는다 — 이 값이 후보 정렬의 1순위 키다.
    expect(buildMerchantSuggestions("", rows)).toEqual([
      { merchant: "쿠팡", count: 1, lastSpentOn: "2026-09-10" },
      { merchant: "이마트", count: 1, lastSpentOn: "2026-09-09" }
    ]);
  });

  it("로컬에서 고친 값이 이긴다 (서버 캐시에 남은 옛 값은 버려진다)", () => {
    const rows = buildSuggestSourceRows({
      childId: CHILD_ID,
      localRows: [
        localRow({
          itemName: "기저귀",
          amountKrw: 41000,
          canonicalId: "exp-1",
          createdAt: "2026-09-11T09:00:00.000Z",
          spentOn: "2026-09-10"
        })
      ],
      currentMonthRows: [serverRow({ id: "exp-1", itemName: "기저귀", amountKrw: 38500, spentOn: "2026-09-10" })]
    });

    expect(buildItemAutocompleteSuggestions("기저", rows)).toEqual([
      { itemName: "기저귀", amountKrw: 41000, categoryId: "cat-diaper" }
    ]);
  });

  it("삭제 대기 행의 서버 쌍둥이도 감춘다 (지운 기록을 제안으로 되살리지 않는다)", () => {
    const rows = buildSuggestSourceRows({
      childId: CHILD_ID,
      localRows: [
        localRow({ itemName: "잘못 적은 젖병", canonicalId: "exp-9", pendingDelete: true, createdAt: "2026-09-10T09:00:00.000Z" })
      ],
      currentMonthRows: [serverRow({ id: "exp-9", itemName: "잘못 적은 젖병", spentOn: "2026-09-10" })]
    });

    expect(rows).toEqual([]);
  });

  it("같은 서버 id가 두 번 실려 와도 한 번만 남는다", () => {
    const duplicated = serverRow({ id: "exp-1", itemName: "기저귀", spentOn: "2026-09-10" });
    const rows = buildSuggestSourceRows({
      childId: CHILD_ID,
      currentMonthRows: [duplicated, { ...duplicated }]
    });

    expect(names(rows)).toEqual(["기저귀"]);
  });

  it("id가 없는 서버 행은 쌍둥이를 알아볼 수 없으므로 그대로 통과시킨다 (임의 추측 금지)", () => {
    const rows = buildSuggestSourceRows({
      childId: CHILD_ID,
      localRows: [localRow({ itemName: "기저귀", canonicalId: "exp-1", createdAt: "2026-09-10T09:00:00.000Z" })],
      currentMonthRows: [serverRow({ itemName: "기저귀", spentOn: "2026-09-10" })]
    });

    expect(rows).toHaveLength(2);
  });

  it("아직 올라가지 않은 로컬 행(canonicalId 없음)은 어떤 서버 행도 지우지 않는다", () => {
    const rows = buildSuggestSourceRows({
      childId: CHILD_ID,
      localRows: [localRow({ itemName: "오프라인 분유", createdAt: "2026-09-10T09:00:00.000Z" })],
      currentMonthRows: [serverRow({ id: "exp-1", itemName: "기저귀", spentOn: "2026-09-09" })]
    });

    expect(names(rows)).toEqual(["오프라인 분유", "기저귀"]);
  });
});

describe("GAP-058 #6 월 경계 — 지난달 캐시", () => {
  it("이번 달 캐시가 비어 있어도 지난달 이력으로 자동완성이 산다 (매달 1일 실종)", () => {
    // 9월 1일 아침: 이번 달 캐시는 아직 0건이다.
    const rows = buildSuggestSourceRows({
      childId: CHILD_ID,
      currentMonthRows: [],
      previousMonthRows: [
        serverRow({ id: "exp-1", itemName: "기저귀", amountKrw: 38500, spentOn: "2026-08-28", merchant: "쿠팡" })
      ]
    });

    expect(buildItemAutocompleteSuggestions("기저", rows)).toEqual([
      { itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper" }
    ]);
    expect(buildMerchantSuggestions("쿠", rows)).toEqual([{ merchant: "쿠팡", count: 1, lastSpentOn: "2026-08-28" }]);
  });

  it("두 달을 이어 붙여도 최신순은 한 벌이다 (이번 달이 지난달보다 앞)", () => {
    const rows = buildSuggestSourceRows({
      childId: CHILD_ID,
      currentMonthRows: [serverRow({ id: "c1", itemName: "9월 기저귀", spentOn: "2026-09-01" })],
      previousMonthRows: [
        serverRow({ id: "p1", itemName: "8월 분유", spentOn: "2026-08-31" }),
        serverRow({ id: "p2", itemName: "8월 물티슈", spentOn: "2026-08-02" })
      ]
    });

    expect(names(rows)).toEqual(["9월 기저귀", "8월 분유", "8월 물티슈"]);
  });

  it("지난달을 넘기지 않으면 종전과 같다 (새 요청을 만들지 않는다)", () => {
    const currentMonthRows = [serverRow({ id: "c1", itemName: "9월 기저귀", spentOn: "2026-09-01" })];

    expect(buildSuggestSourceRows({ childId: CHILD_ID, currentMonthRows })).toEqual(
      buildSuggestSourceRows({ childId: CHILD_ID, currentMonthRows, previousMonthRows: [] })
    );
  });

  it("두 달에 걸친 중복도 canonicalId 한 기준으로 걸러진다", () => {
    const rows = buildSuggestSourceRows({
      childId: CHILD_ID,
      localRows: [localRow({ itemName: "기저귀", canonicalId: "p1", createdAt: "2026-08-31T09:00:00.000Z", spentOn: "2026-08-31" })],
      currentMonthRows: [],
      previousMonthRows: [serverRow({ id: "p1", itemName: "기저귀", spentOn: "2026-08-31" })]
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.origin).toBe("local");
  });
});

describe("GAP-058 #6 소비자 계약 — 통합 목록 하나를 세 함수가 그대로 받는다", () => {
  const input = {
    childId: CHILD_ID,
    localRows: [
      // 비행기 모드에서 방금 적은 행: 서버 캐시에는 아직 없다.
      localRow({
        itemName: "오프라인 기저귀",
        amountKrw: 41000,
        createdAt: "2026-09-10T09:00:00.000Z",
        spentOn: "2026-09-10",
        merchant: "동네약국"
      })
    ],
    currentMonthRows: [serverRow({ id: "exp-1", itemName: "분유", amountKrw: 42000, spentOn: "2026-09-02", merchant: "쿠팡" })],
    previousMonthRows: [
      serverRow({ id: "exp-2", itemName: "물티슈", amountKrw: 9900, spentOn: "2026-08-20", merchant: "쿠팡" })
    ]
  };

  it("품목 자동완성이 오프라인 대기 행과 지난달 행을 함께 본다", () => {
    const rows = buildSuggestSourceRows(input);

    expect(buildItemAutocompleteSuggestions("오프라인", rows)).toEqual([
      { itemName: "오프라인 기저귀", amountKrw: 41000, categoryId: "cat-diaper" }
    ]);
    expect(buildItemAutocompleteSuggestions("물티", rows)).toEqual([
      { itemName: "물티슈", amountKrw: 9900, categoryId: "cat-diaper" }
    ]);
  });

  it("판매처 자동완성도 같은 목록에서 나온다 (빈도는 두 달 합)", () => {
    const rows = buildSuggestSourceRows(input);

    expect(buildMerchantSuggestions("", rows)).toEqual([
      { merchant: "쿠팡", count: 2, lastSpentOn: "2026-09-02" },
      { merchant: "동네약국", count: 1, lastSpentOn: "2026-09-10" }
    ]);
  });

  it("지출 상세의 '자기 행 제외' 한 줄이 통합 목록에서도 그대로 통한다 (id를 잃지 않는다)", () => {
    // 지금 열려 있는 지출(exp-1)은 이 기기에서 한 번 고쳐 로컬 행으로도 남아 있다.
    const rows = buildSuggestSourceRows({
      childId: CHILD_ID,
      localRows: [
        localRow({
          itemName: "기저귀",
          canonicalId: "exp-1",
          createdAt: "2026-09-10T09:00:00.000Z",
          spentOn: "2026-09-10",
          merchant: "지금 고치는 판매처"
        })
      ],
      currentMonthRows: [
        serverRow({ id: "exp-1", itemName: "기저귀", spentOn: "2026-09-10", merchant: "지금 고치는 판매처" }),
        serverRow({ id: "exp-2", itemName: "분유", spentOn: "2026-09-02", merchant: "쿠팡" })
      ]
    });

    expect(buildMerchantSuggestions("", rows.filter((row) => row.id !== "exp-1"))).toEqual([
      { merchant: "쿠팡", count: 1, lastSpentOn: "2026-09-02" }
    ]);
  });

  it("최근 품목 칩은 갈래를 나눠 받는다 (로컬 우선 → 서버 폴백)", () => {
    const { local, server } = partitionSuggestSourceRows(input);

    // 이 기기에 이력이 있으면 서버 행은 보지 않는다.
    expect(buildRecentItemChips(input.localRows, CHILD_ID, { serverRows: input.currentMonthRows })).toEqual([
      { itemName: "오프라인 기저귀", amountKrw: 41000, categoryId: "cat-diaper" }
    ]);
    expect(names(local)).toEqual(["오프라인 기저귀"]);
    expect(names(server)).toEqual(["분유", "물티슈"]);
  });
});
