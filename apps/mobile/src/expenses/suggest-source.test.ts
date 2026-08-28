import { readFileSync } from "node:fs";
import { join } from "node:path";
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

/**
 * 라운드 59 트랙 A — **실패 공장 차단**: 400을 부른 값이 첫 후보로 돌아오지 않는다.
 *
 * 아웃박스를 영구 실패로 굳히는 4xx는 대부분 입력값 자체가 원인이다(101자 품목명·상한 초과 금액·
 * 미래 날짜). 그 행은 로컬 저장이 먼저 성공했으므로 스냅숏에 남고, 이 모듈은 스냅숏을 최근 입력
 * 순으로 앞에 세운다 — 아무 조치도 하지 않으면 그 값이 다음 기록의 첫 제안이 되고, 탭하는 순간
 * 같은 400이 하나 더 생긴다.
 *
 * 경계 셋(영구/일시/레거시)을 각각 고정한다.
 */
describe("라운드 59 트랙 A: 영구 실패 행은 제안 모집단에서 빠진다", () => {
  const failed = (overrides: Parameters<typeof localRow>[0] & { lastErrorStatus?: number | null; lastError?: string }) => ({
    ...localRow(overrides),
    syncState: "failed",
    ...(overrides.lastErrorStatus !== undefined ? { lastErrorStatus: overrides.lastErrorStatus } : {}),
    ...(overrides.lastError !== undefined ? { lastError: overrides.lastError } : {})
  });

  it("400으로 굳은 행은 후보에 없다 (같은 실패를 다시 만들지 않는다)", () => {
    const rows = [
      failed({ itemName: "아주아주 긴 품목명", createdAt: "2026-08-10T00:00:00.000Z", lastErrorStatus: 400 }),
      localRow({ itemName: "기저귀", createdAt: "2026-08-09T00:00:00.000Z" })
    ];

    const local = partitionSuggestSourceRows({ childId: CHILD_ID, localRows: rows }).local;
    expect(local.map((row) => row.itemName)).toEqual(["기저귀"]);
  });

  it("일시 실패(5xx)·전송 중·대기 행은 그대로 남는다 (그 값은 아직 거절되지 않았다)", () => {
    const rows = [
      failed({ itemName: "5xx 실패", createdAt: "2026-08-10T00:00:00.000Z", lastErrorStatus: 503 }),
      { ...localRow({ itemName: "전송 중", createdAt: "2026-08-09T00:00:00.000Z" }), syncState: "syncing" },
      { ...localRow({ itemName: "대기", createdAt: "2026-08-08T00:00:00.000Z" }), syncState: "pending" },
      { ...localRow({ itemName: "충돌", createdAt: "2026-08-07T00:00:00.000Z" }), syncState: "conflict" }
    ];

    const local = partitionSuggestSourceRows({ childId: CHILD_ID, localRows: rows }).local;
    expect(local.map((row) => row.itemName)).toEqual(["5xx 실패", "전송 중", "대기", "충돌"]);
  });

  it("레거시 실패 행(status 없음)은 종전 그대로 후보에 남는다", () => {
    // v2 마이그레이션 이전에 실패한 행에는 status가 없다. 확신 없이 제안을 덜어내면 사용자는
    // 이유를 알 수 없이 이력을 잃는다 -- "모르면 기존 동작"이 이 판정의 안전한 방향이다.
    const rows = [failed({ itemName: "옛 실패", createdAt: "2026-08-10T00:00:00.000Z", lastError: "권한이 없어요." })];
    expect(partitionSuggestSourceRows({ childId: CHILD_ID, localRows: rows }).local.map((r) => r.itemName)).toEqual([
      "옛 실패"
    ]);
  });

  it("syncState를 나르지 않는 호출부(최근 칩 등)는 한 줄도 달라지지 않는다", () => {
    const rows = [localRow({ itemName: "기저귀", createdAt: "2026-08-10T00:00:00.000Z" })];
    expect(buildSuggestSourceRows({ childId: CHILD_ID, localRows: rows })).toHaveLength(1);
    expect(buildRecentItemChips(rows, CHILD_ID).map((chip) => chip.itemName)).toEqual(["기저귀"]);
  });

  it("영구 실패한 **수정** 행은 서버 쌍둥이에게 대표 자리를 돌려준다", () => {
    // 그 수정은 앞으로도 반영되지 않는다. 서버에는 마지막으로 받아들여진 값이 멀쩡히 남아 있으니
    // 이 자리의 사실은 서버 값이다 -- 로컬 대표가 빠졌는데 서버 쌍둥이까지 감추면 그 지출은
    // 어느 원천에서도 후보로 나오지 않는다(사용자가 이유를 알 수 없이 이력을 잃는 자리다).
    const rows = [
      failed({
        itemName: "고치다 만 이름",
        createdAt: "2026-08-10T00:00:00.000Z",
        canonicalId: "exp-1",
        lastErrorStatus: 400
      })
    ];
    const server = [serverRow({ id: "exp-1", itemName: "기저귀", spentOn: "2026-08-01" })];

    const { local, server: serverPart } = partitionSuggestSourceRows({
      childId: CHILD_ID,
      localRows: rows,
      currentMonthRows: server
    });
    expect(local).toHaveLength(0);
    expect(serverPart.map((row) => row.itemName)).toEqual(["기저귀"]);

    // 반대로 **일시** 실패 행은 여전히 자기 쌍둥이를 감춘다(그 값은 곧 서버 값이 된다).
    const transient = [
      failed({
        itemName: "곧 올라갈 이름",
        createdAt: "2026-08-10T00:00:00.000Z",
        canonicalId: "exp-1",
        lastErrorStatus: 503
      })
    ];
    const transientResult = partitionSuggestSourceRows({
      childId: CHILD_ID,
      localRows: transient,
      currentMonthRows: server
    });
    expect(transientResult.local.map((row) => row.itemName)).toEqual(["곧 올라갈 이름"]);
    expect(transientResult.server).toHaveLength(0);
  });

  it("판정 규칙을 여기 다시 적지 않는다 (술어는 permission-denied.ts 한 곳)", () => {
    const moduleSource = readFileSync(join(process.cwd(), "src/expenses/suggest-source.ts"), "utf8");
    expect(moduleSource).toContain('import { isPermanentlyFailedSyncRow } from "../offline/permission-denied";');
    expect(moduleSource.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ")).not.toContain(".lastErrorStatus");
  });
});
