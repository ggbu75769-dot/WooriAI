import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildItemHistory,
  ITEM_HISTORY_MAX_ROWS,
  ITEM_HISTORY_TITLE,
  itemHistoryScopeNotice,
  type ItemHistoryExpense
} from "./item-history";
import type { LocalExpenseRow } from "../offline/types";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const row = (over: Partial<ItemHistoryExpense> & { id: string }): ItemHistoryExpense => ({
  itemName: "기저귀",
  amountKrw: 12000,
  spentOn: "2026-08-10",
  ...over
});

const base = {
  cacheYearMonth: "2026-08",
  itemName: "기저귀",
  currentExpenseId: "current"
};

/** 오프라인 저장소 행 하나(src/home/budget-edit.test.ts와 같은 관례). */
function offlineRow(partial: {
  localId: string;
  childId?: string;
  canonicalId?: string | null;
  syncState?: LocalExpenseRow["syncState"];
  pendingDelete?: boolean;
  itemName?: string;
  amountKrw?: number;
  spentOn?: string;
}): LocalExpenseRow {
  const childId = partial.childId ?? "child-1";
  return {
    localId: partial.localId,
    canonicalId: partial.canonicalId ?? null,
    childId,
    payload: {
      childId,
      categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
      amountKrw: partial.amountKrw ?? 9000,
      spentOn: partial.spentOn ?? "2026-08-18",
      itemName: partial.itemName ?? "기저귀",
      expenseType: "expense"
    },
    version: null,
    syncState: partial.syncState ?? "pending",
    pendingDelete: partial.pendingDelete ?? false,
    conflictCurrent: null,
    lastError: null,
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z"
  };
}

describe("라운드 41 UX-U(B-ⓓ) 이 품목 이력", () => {
  it("캐시가 없으면(콜드 스타트) 섹션 자체를 만들지 않는다 -- 새 요청도 '0건'도 없다", () => {
    expect(buildItemHistory({ ...base, cachedMonthExpenses: undefined })).toBeNull();
    expect(buildItemHistory({ ...base, cachedMonthExpenses: null })).toBeNull();
  });

  it("캐시가 비어 있거나 같은 품목이 없으면 섹션을 생략한다", () => {
    expect(buildItemHistory({ ...base, cachedMonthExpenses: [] })).toBeNull();
    expect(
      buildItemHistory({ ...base, cachedMonthExpenses: [row({ id: "a", itemName: "분유" })] })
    ).toBeNull();
  });

  it("품목명을 아직 안 적었으면(빈 값) 아무것도 찾지 않는다", () => {
    expect(
      buildItemHistory({ ...base, itemName: "   ", cachedMonthExpenses: [row({ id: "a" })] })
    ).toBeNull();
  });

  it("지금 보고 있는 지출(자기 자신)은 이력에서 뺀다", () => {
    const history = buildItemHistory({
      ...base,
      cachedMonthExpenses: [row({ id: "current" }), row({ id: "older", spentOn: "2026-08-01" })]
    });
    expect(history?.rows.map((entry) => entry.id)).toEqual(["older"]);

    // 자기 자신 하나뿐이면 남는 것이 없어 섹션이 통째로 사라진다.
    expect(buildItemHistory({ ...base, cachedMonthExpenses: [row({ id: "current" })] })).toBeNull();
  });

  it("정규화(공백·대소문자)는 item-name-match의 단일 소스를 그대로 쓴다", () => {
    const history = buildItemHistory({
      ...base,
      itemName: "물티슈",
      cachedMonthExpenses: [
        row({ id: "spaced", itemName: "물 티슈", spentOn: "2026-08-03" }),
        row({ id: "other", itemName: "기저귀", spentOn: "2026-08-01" })
      ]
    });
    // "물 티슈"와 "물티슈"는 같은 물건을 띄어쓰기만 다르게 적은 것이다.
    expect(history?.rows.map((entry) => entry.id)).toEqual(["spaced"]);

    // 영문 상품명은 대소문자를 무시한다.
    const english = buildItemHistory({
      ...base,
      itemName: "pampers",
      cachedMonthExpenses: [row({ id: "en", itemName: "Pampers" })]
    });
    expect(english?.rows.map((entry) => entry.id)).toEqual(["en"]);
  });

  it("라운드 41 K-11 ②: 느슨한 매치(prefix/contains/containedBy)는 이력에 넣지 않는다", () => {
    // "기저귀 크림" 상세에서 "기저귀" 기록이 이력으로 뜨면, 사용자는 **다른 물건의 단가**로
    // 이 지출이 비싼지 싼지를 판단하게 된다. 자동완성(넓게 건져 올리는 것이 목적)과 목적이 다르다.
    const cream = buildItemHistory({
      ...base,
      itemName: "기저귀 크림",
      cachedMonthExpenses: [
        row({ id: "diaper", itemName: "기저귀", spentOn: "2026-08-20" }),
        row({ id: "cream", itemName: "기저귀크림", spentOn: "2026-08-02" })
      ]
    });
    expect(cream?.rows.map((entry) => entry.id)).toEqual(["cream"]);

    // 반대 방향(prefix)도 마찬가지 -- "기저귀" 상세에 "기저귀 대형"은 다른 물건이다.
    expect(
      buildItemHistory({
        ...base,
        itemName: "기저귀",
        cachedMonthExpenses: [row({ id: "prefix", itemName: "기저귀 대형" })]
      })
    ).toBeNull();
  });

  it("같은 이름끼리는 최신순으로 놓는다", () => {
    const history = buildItemHistory({
      ...base,
      cachedMonthExpenses: [
        row({ id: "exact-old", itemName: "기저귀", spentOn: "2026-08-02" }),
        row({ id: "exact-new", itemName: "기저귀", spentOn: "2026-08-15" })
      ]
    });
    expect(history?.rows.map((entry) => entry.id)).toEqual(["exact-new", "exact-old"]);
  });

  it("기본 3건까지만 보여 준다", () => {
    const history = buildItemHistory({
      ...base,
      cachedMonthExpenses: [
        row({ id: "a", spentOn: "2026-08-05" }),
        row({ id: "b", spentOn: "2026-08-04" }),
        row({ id: "c", spentOn: "2026-08-03" }),
        row({ id: "d", spentOn: "2026-08-02" })
      ]
    });
    expect(ITEM_HISTORY_MAX_ROWS).toBe(3);
    expect(history?.rows.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("날짜 · 금액 · 스크린리더 라벨을 화면이 그대로 쓸 수 있게 만든다", () => {
    const history = buildItemHistory({
      ...base,
      cachedMonthExpenses: [row({ id: "a", amountKrw: 12000, spentOn: "2026-08-09" })]
    });
    expect(history?.title).toBe(ITEM_HISTORY_TITLE);
    expect(history?.rows[0]).toMatchObject({
      dateLabel: "8월 9일",
      amountLabel: "12,000원",
      itemName: "기저귀",
      accessibilityLabel: "8월 9일, 기저귀, 12,000원"
    });
  });

  it("이상한 날짜 문자열은 지어내지 않고 원본을 그대로 둔다", () => {
    const history = buildItemHistory({
      ...base,
      cachedMonthExpenses: [row({ id: "a", spentOn: "2026/08/09" })]
    });
    expect(history?.rows[0].dateLabel).toBe("2026/08/09");
  });

  it("라운드 41 K-11 ①: 아직 올라가지 않은 대기·실패·충돌 행도 '이번 달 기록'에 든다", () => {
    const history = buildItemHistory({
      ...base,
      cachedMonthExpenses: [row({ id: "server", spentOn: "2026-08-01", amountKrw: 12000 })],
      offline: {
        childId: "child-1",
        rows: [
          offlineRow({ localId: "l-pending", spentOn: "2026-08-05", amountKrw: 9000 }),
          offlineRow({ localId: "l-failed", syncState: "failed", spentOn: "2026-08-06", amountKrw: 8000 }),
          offlineRow({ localId: "l-conflict", syncState: "conflict", spentOn: "2026-08-07", amountKrw: 7000 })
        ]
      }
    });
    // 서버 id가 없는 신규 행은 로컬 id로 식별한다 -- 어떤 서버 지출 id와도 겹치지 않는다.
    expect(history?.rows.map((entry) => entry.id)).toEqual(["local:l-conflict", "local:l-failed", "local:l-pending"]);
    expect(history?.rows.map((entry) => entry.amountLabel)).toEqual(["7,000원", "8,000원", "9,000원"]);
  });

  it("K-11 ①: 로컬에서 고친 서버 행은 **바뀐 값**으로 한 번만 나온다(중복·낡은 금액 금지)", () => {
    const history = buildItemHistory({
      ...base,
      cachedMonthExpenses: [row({ id: "e-1", spentOn: "2026-08-10", amountKrw: 12000 })],
      offline: {
        childId: "child-1",
        rows: [offlineRow({ localId: "l-1", canonicalId: "e-1", spentOn: "2026-08-10", amountKrw: 15000 })]
      }
    });
    expect(history?.rows.map((entry) => entry.id)).toEqual(["e-1"]);
    expect(history?.rows[0].amountLabel).toBe("15,000원");
  });

  it("K-11 ①: 삭제 대기 행은 빠지고, 다른 아이의 행은 섞이지 않는다", () => {
    expect(
      buildItemHistory({
        ...base,
        cachedMonthExpenses: [],
        offline: {
          childId: "child-1",
          rows: [offlineRow({ localId: "l-gone", pendingDelete: true })]
        }
      })
    ).toBeNull();

    expect(
      buildItemHistory({
        ...base,
        cachedMonthExpenses: [],
        offline: { childId: "child-1", rows: [offlineRow({ localId: "l-other", childId: "child-2" })] }
      })
    ).toBeNull();
  });

  it("K-11 ①: 지금 편집 중인 서버 행의 로컬 사본은 '자기 자신'으로 걸러진다", () => {
    expect(
      buildItemHistory({
        ...base,
        cachedMonthExpenses: [row({ id: "current" })],
        offline: {
          childId: "child-1",
          rows: [offlineRow({ localId: "l-current", canonicalId: "current", amountKrw: 15000 })]
        }
      })
    ).toBeNull();
  });

  it("K-11 ①: 스냅숏을 넘기지 않거나 아이를 모르면 종전대로 서버 캐시만 본다", () => {
    const rows = [offlineRow({ localId: "l-1" })];
    expect(buildItemHistory({ ...base, cachedMonthExpenses: [] })).toBeNull();
    expect(buildItemHistory({ ...base, cachedMonthExpenses: [], offline: { childId: null, rows } })).toBeNull();
  });

  it("이 목록이 이번 달 캐시만 본다는 사실을 범위 고지로 밝힌다(라운드 39 UX-P 관례)", () => {
    expect(itemHistoryScopeNotice("2026-08")).toBe("이번 달(8월) 기록 기준이에요");
    expect(itemHistoryScopeNotice("2026-12")).toBe("이번 달(12월) 기록 기준이에요");
    // 달을 모르면 달 표기 없이 범위만 밝힌다(틀린 달을 적지 않는다).
    expect(itemHistoryScopeNotice("bogus")).toBe("이번 달 기록 기준이에요");

    const history = buildItemHistory({ ...base, cachedMonthExpenses: [row({ id: "a" })] });
    expect(history?.scopeNotice).toBe("이번 달(8월) 기록 기준이에요");
  });
});

/**
 * 라운드 85 B — **이 섹션이 두 달을 본다.**
 *
 * 왜: 같은 화면(app/expenses/[expenseId].tsx)이 GAP-058 #6 이후 지난달 캐시를 이미 읽어
 * 판매처 칩·자동완성에 넘기는데, 30cm 옆의 이 섹션에는 그 값이 넘어가지 않았다. 그래서 매달
 * 1일 아침에는 판단 근거가 화면 안에 있는데도 섹션이 통째로 사라졌다.
 *
 * 규율(전부 아래가 문다): 새 요청 0건(호출부가 이미 손에 든 배열만) · 상한 3 불변 ·
 * 매칭 규칙 불변 · 파생 수치 0건 · 재조정은 **달 단위** · 고지는 **실제로 센 달**에서 파생.
 */
describe("라운드 85 B: 이 품목 이력이 두 달을 본다", () => {
  /** 9월 3일에 상세를 여는 상황 — 이번 달은 거의 비어 있고 8월에 두 번 샀다. */
  const septBase = {
    cacheYearMonth: "2026-09",
    previousCacheYearMonth: "2026-08",
    itemName: "기저귀",
    currentExpenseId: "current"
  };

  it("ⓐ 폴백: 지난달 인자를 넘기지 않으면 오늘 결과와 완전히 같다", () => {
    const cached = [row({ id: "a", spentOn: "2026-08-10" }), row({ id: "b", spentOn: "2026-08-02" })];
    const today = buildItemHistory({ ...base, cachedMonthExpenses: cached });

    // 둘 중 하나만 넘기는 것은 "지난달을 셌다"가 아니다 — 배열만, 달만 있는 경우 모두 종전 그대로.
    expect(buildItemHistory({ ...base, cachedMonthExpenses: cached, cachedPreviousMonthExpenses: [row({ id: "p", spentOn: "2026-07-30" })] })).toEqual(today);
    expect(buildItemHistory({ ...base, cachedMonthExpenses: cached, previousCacheYearMonth: "2026-07" })).toEqual(today);
    // null/undefined를 명시적으로 넘기는 것도 안 넘긴 것과 같다.
    expect(
      buildItemHistory({
        ...base,
        cachedMonthExpenses: cached,
        cachedPreviousMonthExpenses: null,
        previousCacheYearMonth: null
      })
    ).toEqual(today);
    expect(today?.scopeNotice).toBe("이번 달(8월) 기록 기준이에요");
  });

  it("ⓕ 침묵: 이번 달 캐시가 없으면 지난달이 두둑해도 여전히 null이다", () => {
    for (const cachedMonthExpenses of [undefined, null]) {
      expect(
        buildItemHistory({
          ...septBase,
          cachedMonthExpenses,
          cachedPreviousMonthExpenses: [row({ id: "aug", spentOn: "2026-08-20" })]
        })
      ).toBeNull();
    }
  });

  it("매달 1일에 사라지던 그 섹션이 지난달 기록으로 선다(실패 시나리오 그대로)", () => {
    const history = buildItemHistory({
      ...septBase,
      itemName: "젖병 세정제",
      cachedMonthExpenses: [],
      cachedPreviousMonthExpenses: [
        row({ id: "aug-1", itemName: "젖병세정제", amountKrw: 8900, spentOn: "2026-08-06" }),
        row({ id: "aug-2", itemName: "젖병 세정제", amountKrw: 9900, spentOn: "2026-08-21" })
      ]
    });
    expect(history?.rows.map((entry) => entry.id)).toEqual(["aug-2", "aug-1"]);
    // 나열이지 비교가 아니다 — 평균·최저·"평소보다" 같은 파생 수치는 결과 어디에도 없다.
    expect(Object.keys(history ?? {}).sort()).toEqual(["rows", "scopeNotice", "title"]);
  });

  it("ⓔ 범위 고지는 손으로 적지 않고 **실제로 센 달**에서 파생한다", () => {
    const twoMonths = buildItemHistory({
      ...septBase,
      cachedMonthExpenses: [row({ id: "sep", spentOn: "2026-09-02" })],
      cachedPreviousMonthExpenses: [row({ id: "aug", spentOn: "2026-08-20" })]
    });
    expect(twoMonths?.scopeNotice).toBe("이번 달(9월) · 지난달(8월) 기록 기준이에요");

    // 지난달 캐시가 없으면(콜드 스타트) 고지가 **다시 한 달로 돌아간다** — 안 본 달을 말하지 않는다.
    const oneMonth = buildItemHistory({
      ...septBase,
      cachedMonthExpenses: [row({ id: "sep", spentOn: "2026-09-02" })],
      cachedPreviousMonthExpenses: null
    });
    expect(oneMonth?.scopeNotice).toBe("이번 달(9월) 기록 기준이에요");

    // 빈 배열은 "아직 모른다"가 아니라 "받아 봤더니 0건"이다 — 그 달은 실제로 셌다.
    const emptyPrevious = buildItemHistory({
      ...septBase,
      cachedMonthExpenses: [row({ id: "sep", spentOn: "2026-09-02" })],
      cachedPreviousMonthExpenses: []
    });
    expect(emptyPrevious?.scopeNotice).toBe("이번 달(9월) · 지난달(8월) 기록 기준이에요");

    // 같은 달을 두 번 넘기면 두 번 세지 않는다(줄도 고지도 한 벌이다).
    const sameMonth = buildItemHistory({
      ...base,
      cachedMonthExpenses: [row({ id: "a", spentOn: "2026-08-10" })],
      cachedPreviousMonthExpenses: [row({ id: "a", spentOn: "2026-08-10" })],
      previousCacheYearMonth: "2026-08"
    });
    expect(sameMonth?.rows.map((entry) => entry.id)).toEqual(["a"]);
    expect(sameMonth?.scopeNotice).toBe("이번 달(8월) 기록 기준이에요");
  });

  it("ⓔ 달 문자열이 이상하면 그 달만 표기를 빼고 범위는 그대로 말한다", () => {
    expect(itemHistoryScopeNotice("2026-09", "2026-08")).toBe("이번 달(9월) · 지난달(8월) 기록 기준이에요");
    expect(itemHistoryScopeNotice("2026-09", "bogus")).toBe("이번 달(9월) · 지난달 기록 기준이에요");
    expect(itemHistoryScopeNotice("bogus", "2026-08")).toBe("이번 달 · 지난달(8월) 기록 기준이에요");
    // 한 달짜리 호출은 인자 하나였을 때와 한 글자도 다르지 않다(ⓐ).
    expect(itemHistoryScopeNotice("2026-09", null)).toBe(itemHistoryScopeNotice("2026-09"));
    expect(itemHistoryScopeNotice("2026-09", "")).toBe(itemHistoryScopeNotice("2026-09"));
  });

  it("ⓓ 정렬·상한: 이번 달 행이 언제나 앞이고, 잘리는 쪽은 언제나 지난달이다", () => {
    const history = buildItemHistory({
      ...septBase,
      cachedMonthExpenses: [row({ id: "sep-old", spentOn: "2026-09-01" }), row({ id: "sep-new", spentOn: "2026-09-05" })],
      cachedPreviousMonthExpenses: [row({ id: "aug-new", spentOn: "2026-08-30" }), row({ id: "aug-old", spentOn: "2026-08-02" })]
    });
    // 달 안에서는 최신순, 달끼리는 이번 달 → 지난달. 상한 3에서 잘린 것은 가장 오래된 8월 행이다.
    expect(ITEM_HISTORY_MAX_ROWS).toBe(3);
    expect(history?.rows.map((entry) => entry.id)).toEqual(["sep-new", "sep-old", "aug-new"]);

    // 이번 달이 상한을 채우면 지난달은 한 줄도 서지 않는다(상한은 두 달을 봐도 3 그대로).
    const full = buildItemHistory({
      ...septBase,
      cachedMonthExpenses: [
        row({ id: "s1", spentOn: "2026-09-05" }),
        row({ id: "s2", spentOn: "2026-09-04" }),
        row({ id: "s3", spentOn: "2026-09-03" })
      ],
      cachedPreviousMonthExpenses: [row({ id: "aug", spentOn: "2026-08-30" })]
    });
    expect(full?.rows.map((entry) => entry.id)).toEqual(["s1", "s2", "s3"]);
    /**
     * ⚠️ **라운드 85 리뷰 M-1 — 이 기대값은 "두 달"에서 "이번 달"로 바뀌었다(계약 약화가 아니라
     * 허위 정정이다).**
     *
     * 종전 기대는 *"지난달 캐시를 실제로 손에 들고 훑었다"* 를 근거로 두 달을 말했는데, 그
     * 근거가 사실이 아니었다: 상한(3)을 이번 달이 채우면 루프는 지난달 칸을 **열지도 않고**
     * 빠져나온다(모듈 주석이 바로 그 한 줄 위에서 그렇게 단언한다 — *"상한을 채우면 지난달은
     * 훑지도 않는다"*). 즉 그 화면은 지난달 행을 **0건** 그리면서 "지난달(8월) 기록 기준"이라고
     * 말하고 있었고, 사용자는 그것을 *"지난달에는 더 싸게 산 기록이 없구나"* 로 읽는다 — 이
     * 모듈이 범위 고지를 두는 이유(라운드 39 UX-P: 말하지 않은 범위는 조용한 허위 표시다)를
     * 정확히 뒤집는 표시다. 정직한 값은 실제로 센 한 달이다.
     */
    expect(full?.scopeNotice).toBe("이번 달(9월) 기록 기준이에요");
  });

  /**
   * 라운드 85 리뷰 M-1 — 위 정정을 **시나리오 자체로** 못 박는다(문구 한 줄이 아니라 관계로).
   * 계약: 고지에 지난달이 오르는 것과 목록에 지난달 행이 서는 것은 **같은 조건**이다.
   */
  it("M-1: 지난달 칸을 열지 못한 날에는 고지도 지난달을 말하지 않는다 (표시와 고지가 같은 사실을 본다)", () => {
    const previous = [row({ id: "aug", spentOn: "2026-08-30" })];
    const currentMonthRow = (id: string, day: string) => row({ id, spentOn: `2026-09-${day}` });

    // 상한을 한 칸 남긴 이번 달 → 지난달을 열고, 그 줄이 실제로 선다 → 고지도 두 달.
    const roomLeft = buildItemHistory({
      ...septBase,
      cachedMonthExpenses: [currentMonthRow("s1", "05"), currentMonthRow("s2", "04")],
      cachedPreviousMonthExpenses: previous
    });
    expect(roomLeft?.rows.map((entry) => entry.id)).toEqual(["s1", "s2", "aug"]);
    expect(roomLeft?.scopeNotice).toBe("이번 달(9월) · 지난달(8월) 기록 기준이에요");

    // 이번 달이 상한을 채움 → 지난달을 열지 않는다 → 목록에도 고지에도 지난달이 0건.
    const noRoom = buildItemHistory({
      ...septBase,
      cachedMonthExpenses: [currentMonthRow("s1", "05"), currentMonthRow("s2", "04"), currentMonthRow("s3", "03")],
      cachedPreviousMonthExpenses: previous
    });
    expect(noRoom?.rows.map((entry) => entry.id)).toEqual(["s1", "s2", "s3"]);
    expect(noRoom?.scopeNotice).toBe("이번 달(9월) 기록 기준이에요");

    // 관계로 못 박는다 — **같은 지난달 캐시**(걸리는 행 하나가 든)를 두 번 넘겼으므로, 이 두
    // 결과에서는 "고지가 지난달을 말한다"와 "목록에 지난달 행이 있다"가 같은 값이어야 한다.
    // (지난달을 열었는데 걸리는 행이 0건인 경우는 별개의 정직한 갈래다 — 위 ⓔ의 빈 배열 줄.)
    for (const history of [roomLeft, noRoom]) {
      const noticeMentionsPrevious = history!.scopeNotice.includes("지난달");
      const listHasPreviousRow = history!.rows.some((entry) => entry.id === "aug");
      expect(noticeMentionsPrevious, history!.scopeNotice).toBe(listHasPreviousRow);
    }
  });

  it("ⓓ 날짜가 같아도 이번 달 행이 지난달 행보다 앞선다(달 경계가 데이터에 흔들리지 않는다)", () => {
    // 있을 수 없는 날짜 조합(9월 캐시에 8월 날짜)이 와도 순서가 뒤집히지 않는다는 사실을 고정한다.
    const history = buildItemHistory({
      ...septBase,
      cachedMonthExpenses: [row({ id: "sep-cache", spentOn: "2026-08-10" })],
      cachedPreviousMonthExpenses: [row({ id: "aug-cache", spentOn: "2026-08-10" })]
    });
    expect(history?.rows.map((entry) => entry.id)).toEqual(["sep-cache", "aug-cache"]);
  });

  it("ⓒ 자기 자신은 두 달 어디에서도 이력에 서지 않는다(canonicalId 갈래 포함)", () => {
    // 지난달 캐시에 들어 있는 지금 그 지출.
    expect(
      buildItemHistory({
        ...septBase,
        cachedMonthExpenses: [],
        cachedPreviousMonthExpenses: [row({ id: "current", spentOn: "2026-08-20" })]
      })
    ).toBeNull();

    // 그 지출을 이 기기에서 고쳐 둔 로컬 사본(canonicalId = current)도 마찬가지다.
    expect(
      buildItemHistory({
        ...septBase,
        cachedMonthExpenses: [],
        cachedPreviousMonthExpenses: [row({ id: "current", spentOn: "2026-08-20" })],
        offline: {
          childId: "child-1",
          rows: [offlineRow({ localId: "l-current", canonicalId: "current", spentOn: "2026-08-20", amountKrw: 15000 })]
        }
      })
    ).toBeNull();
  });

  it("ⓑ 모집단: 두 달이 **각자** 재조정을 지난다(로컬 대기 행이 자기 달에만 든다)", () => {
    const history = buildItemHistory({
      ...septBase,
      cachedMonthExpenses: [row({ id: "sep-server", spentOn: "2026-09-02", amountKrw: 12000 })],
      cachedPreviousMonthExpenses: [row({ id: "aug-server", spentOn: "2026-08-02", amountKrw: 11000 })],
      offline: {
        childId: "child-1",
        rows: [
          offlineRow({ localId: "l-sep", spentOn: "2026-09-04", amountKrw: 9000 }),
          offlineRow({ localId: "l-aug", spentOn: "2026-08-20", amountKrw: 8000 })
        ]
      }
    });
    // 9월 대기 행은 9월 묶음에, 8월 대기 행은 8월 묶음에 — 한 번씩만 선다(양방향 누수 0건).
    expect(history?.rows.map((entry) => entry.id)).toEqual(["local:l-sep", "sep-server", "local:l-aug"]);
    expect(history?.rows.map((entry) => entry.amountLabel)).toEqual(["9,000원", "12,000원", "8,000원"]);
  });

  it("ⓑ 지난달 서버 행을 로컬에서 고쳤으면 **바뀐 금액**으로 한 번만 나온다", () => {
    const history = buildItemHistory({
      ...septBase,
      cachedMonthExpenses: [],
      cachedPreviousMonthExpenses: [row({ id: "aug-1", spentOn: "2026-08-10", amountKrw: 12000 })],
      offline: {
        childId: "child-1",
        rows: [offlineRow({ localId: "l-1", canonicalId: "aug-1", spentOn: "2026-08-10", amountKrw: 15000 })]
      }
    });
    expect(history?.rows.map((entry) => entry.id)).toEqual(["aug-1"]);
    expect(history?.rows[0].amountLabel).toBe("15,000원");
  });

  it("ⓑ 지난달 삭제 대기 행은 지난달에서도 빠지고, 다른 아이의 행은 섞이지 않는다", () => {
    expect(
      buildItemHistory({
        ...septBase,
        cachedMonthExpenses: [],
        cachedPreviousMonthExpenses: [],
        offline: {
          childId: "child-1",
          rows: [
            offlineRow({ localId: "l-gone", spentOn: "2026-08-11", pendingDelete: true }),
            offlineRow({ localId: "l-other", spentOn: "2026-08-12", childId: "child-2" })
          ]
        }
      })
    ).toBeNull();
  });

  it("두 달을 봐도 매칭 규칙은 그대로다(K-11 ② — 느슨한 매치는 지난달에서도 안 온다)", () => {
    expect(
      buildItemHistory({
        ...septBase,
        itemName: "기저귀 크림",
        cachedMonthExpenses: [],
        cachedPreviousMonthExpenses: [row({ id: "aug-diaper", itemName: "기저귀", spentOn: "2026-08-20" })]
      })
    ).toBeNull();
  });

  it("입력 배열은 두 달 모두 제자리에서 바뀌지 않는다", () => {
    const current = [row({ id: "s2", spentOn: "2026-09-01" }), row({ id: "s1", spentOn: "2026-09-05" })];
    const previous = [row({ id: "a2", spentOn: "2026-08-01" }), row({ id: "a1", spentOn: "2026-08-05" })];
    const currentBefore = [...current];
    const previousBefore = [...previous];

    buildItemHistory({ ...septBase, cachedMonthExpenses: current, cachedPreviousMonthExpenses: previous });

    expect(current).toEqual(currentBefore);
    expect(previous).toEqual(previousBefore);
    expect(previous[0]).toBe(previousBefore[0]);
  });
});

/**
 * 화면 배선은 소스 그렙으로 확인한다(react-native 화면은 vitest에서 렌더할 수 없다).
 * 핵심 계약: **새 요청 금지** -- 이 섹션은 getQueryData로 이미 받아 둔 캐시만 읽는다.
 */
describe("라운드 41 UX-U(B-ⓓ) 지출 상세 배선", () => {
  const screen = () => source("app/expenses/[expenseId].tsx");

  it("이미 있는 월 캐시를 getQueryData로 읽기만 한다(useQuery 추가 금지)", () => {
    const screenSource = screen();
    expect(screenSource).toContain(
      'queryClient.getQueryData<MonthExpenses>(["expenses", historyChildId, currentYearMonth])?.expenses'
    );
    // 기존 네 개(expense · categories · children · household-members) 외에 새 쿼리가 생기지 않았다.
    expect(screenSource.match(/useQuery\(\{/g) ?? []).toHaveLength(4);
  });

  it("라운드 41 K-11 ①: 오프라인 스냅숏을 그대로 넘겨 모집단을 맞춘다(새 요청 없음)", () => {
    const screenSource = screen();
    expect(screenSource).toContain("const offlineSyncSnapshot = useOfflineSyncSnapshot();");
    expect(screenSource).toContain("offline: { rows: offlineSyncSnapshot.rows, childId: historyChildId }");
    // 화면이 직접 재조정하지 않는다 -- childId·달로 좁히는 일도 순수 모듈이 한다.
    expect(screenSource).not.toContain("reconcileMonthlyExpenses(");
  });

  it("순수 모듈의 결과가 null이면 섹션을 아예 렌더하지 않는다", () => {
    expect(screen()).toContain("buildItemHistory({");
    expect(screen()).toContain("{itemHistory ? (");
    expect(screen()).toContain("{itemHistory.scopeNotice}");
    expect(screen()).toContain("{itemHistory.title}");
  });

  /**
   * 라운드 42 L-5 — 상세 화면은 품목·금액·메모가 전부 입력 상태라, 이력 재조정이 렌더 본문에
   * 있으면 **키 한 번마다** 이번 달 전체(수백 행)를 다시 합치고 정렬하고 걸렀다.
   */
  it("L-5: 이력은 useMemo 안에서 만들고, 품목명은 정규화 값이 의존성이다", () => {
    const screenSource = screen();
    expect(screenSource).toContain("const itemHistory = useMemo(");
    expect(screenSource).toContain("const normalizedHistoryItemName = normalizeItemName(itemName);");
    expect(screenSource).toContain("normalizedHistoryItemName");
    // 재료가 바뀔 때만 다시 돈다(캐시 참조 · 스냅숏 참조 · 달 · 이 지출 · 대상 아이).
    expect(screenSource).toContain("cachedMonthExpenses, currentYearMonth, normalizedHistoryItemName, expenseId");
    expect(screenSource).toContain("offlineSyncSnapshot.rows, historyChildId");
    // 렌더 본문에서 직접 부르던 옛 배선.
    expect(screenSource).not.toContain("const itemHistory = buildItemHistory({");
    // 정규화는 UX-C의 단일 소스를 쓴다(사본 금지).
    expect(screenSource).toContain('from "../../src/expenses/item-name-match"');
    // 같은 모듈을 두 번 import하던 중복(K-11 때 갈라진 두 줄)도 한 줄로 합쳤다.
    expect(screenSource.match(/from "\.\.\/\.\.\/src\/offline\/sync-controller"/g) ?? []).toHaveLength(1);
  });

  /**
   * 라운드 42 L-5 — `sortByRecency`가 이미 복사본을 정렬해 돌려주므로(item-name-match.ts) 그
   * 앞에서 한 번 더 뜨던 전체 복사는 순수 낭비였다. 복사를 뺀 뒤에도 **입력 배열은 그대로**여야 한다.
   */
  it("L-5: 입력 배열을 제자리에서 바꾸지 않는다(복사 제거 후에도 무해)", () => {
    const cached = [
      { id: "e-1", itemName: "기저귀", amountKrw: 10_000, spentOn: "2026-08-02" },
      { id: "e-2", itemName: "기저귀", amountKrw: 12_000, spentOn: "2026-08-20" }
    ];
    const before = [...cached];

    const history = buildItemHistory({
      cachedMonthExpenses: cached,
      cacheYearMonth: "2026-08",
      itemName: "기저귀",
      currentExpenseId: "e-9"
    });

    expect(history?.rows.map((row) => row.id)).toEqual(["e-2", "e-1"]);
    // 원본 순서·참조가 그대로다(캐시 배열을 정렬해 버리면 목록 화면이 함께 흔들린다).
    expect(cached).toEqual(before);
    expect(cached[0]).toBe(before[0]);
  });

  /**
   * 라운드 85 B — 화면이 **이미 만들어 둔** 지난달 값 둘이 이력에도 넘어간다.
   * 그 값은 판매처 칩이 쓰는 바로 그것이라(`:430-434`), 새 요청도 새 키도 늘지 않는다.
   */
  it("라운드 85 B: 판매처 칩이 쓰는 지난달 캐시를 이력에도 그대로 넘긴다(새 요청 0건)", () => {
    const screenSource = screen();
    expect(screenSource).toContain("cachedPreviousMonthExpenses,\n        previousCacheYearMonth: previousMonth,");
    // 지난달 값의 출처는 여전히 getQueryData 한 줄뿐이다(두 소비자가 같은 배열을 본다).
    expect(screenSource.match(/const cachedPreviousMonthExpenses =/g) ?? []).toHaveLength(1);
    expect(screenSource).toContain(
      'queryClient.getQueryData<MonthExpenses>(["expenses", historyChildId, previousMonth])?.expenses'
    );
    // 쿼리 수는 그대로 넷이다(expense · categories · children · household-members).
    expect(screenSource.match(/useQuery\(\{/g) ?? []).toHaveLength(4);
    // 재료가 늘었으니 useMemo 의존성도 함께 늘었다(캐시가 늦게 도착해도 이력이 그대로 굳지 않는다).
    expect(screenSource).toContain("historyChildId, cachedPreviousMonthExpenses, previousMonth]");
    // 달 경계 계산은 화면에 한 번뿐이고, 순수 모듈은 그 결과를 받기만 한다.
    expect(screenSource.match(/previousYearMonth\(currentYearMonth\)/g) ?? []).toHaveLength(1);
  });

  it("범위 고지 줄이 목록과 같은 카드 안에 있다(고지 없이 목록만 보이지 않는다)", () => {
    const screenSource = screen();
    const block = screenSource.slice(screenSource.indexOf("{itemHistory ? ("));
    const cardEnd = block.indexOf(") : null}");
    expect(cardEnd).toBeGreaterThan(0);
    expect(block.slice(0, cardEnd)).toContain("{itemHistory.scopeNotice}");
    expect(block.slice(0, cardEnd)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("라운드 41 UX-U(B-ⓑ/ⓒ) 지출 상세의 나머지 배선", () => {
  const screen = () => source("app/expenses/[expenseId].tsx");

  it("저장 · 삭제 뒤에는 진입 스택이 있으면 왔던 자리로 돌아간다", () => {
    const screenSource = screen();
    expect(screenSource).toContain("if (router.canGoBack()) router.back();");
    expect(screenSource).toContain('else router.replace("/(tabs)/records");');
    // 두 뮤테이션 모두 같은 한 곳을 쓴다 -- 저장과 삭제가 서로 다른 곳으로 가면 안 된다.
    // GAP-056 #6: 그 예약은 맨몸이 아니라 leaveTimerRef를 거친다(언마운트에서 취소 가능해야 한다).
    expect(screenSource.match(/leaveTimerRef\.current = setTimeout\(leaveAfterMutation, 650\)/g) ?? []).toHaveLength(2);
    expect(screenSource.match(/setTimeout\(leaveAfterMutation, 650\)/g) ?? []).toHaveLength(2);
    expect(screenSource).not.toContain('setTimeout(() => router.replace("/(tabs)/records"), 650)');
  });

  /**
   * 라운드 57 QA(P2-3) — **두 입력 화면이 같은 봉합 관례를 쓴다.**
   *
   * 이 화면이 GAP-056 #6에서 고친 것과 똑같은 결함(저장 후 650ms 이동 타이머가 언마운트를 넘어
   * 살아남아 사용자가 방금 고른 화면을 덮어씀)이 빠른 기록 시트에는 그대로 남아 있었다. 관례가
   * 한쪽에만 있으면 다음 화면이 또 맨몸 setTimeout으로 시작하므로, 두 화면을 한 자리에서 묶는다.
   */
  it("빠른 기록 시트도 같은 leaveTimerRef 관례로 이동 타이머를 봉합한다", () => {
    for (const screenPath of ["app/expenses/[expenseId].tsx", "app/expenses/new.tsx"]) {
      const src = source(screenPath);
      expect(src, screenPath).toContain("const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);");
      expect(src, screenPath).toContain("if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);");
    }
  });

  it("금액 프리셋 칩은 빠른 기록과 같은 모듈을 쓰고 44dp 타깃을 지킨다", () => {
    const screenSource = screen();
    expect(screenSource).toContain('} from "../../src/expenses/amount-presets";');
    expect(screenSource).toContain("setAmountDigits((value) => addAmountPreset(value, presetKrw))");
    expect(screenSource).toContain("onLongPress={() => setAmountDigits(clearAmountText())}");
    expect(screenSource).toContain("const canTapAmountPreset = canAddAmountPreset(amountDigits);");
    const chipBlock = screenSource.slice(
      screenSource.indexOf("{QUICK_AMOUNT_PRESETS_KRW.map"),
      screenSource.indexOf("지우기</Text>")
    );
    expect(chipBlock).toContain("minHeight: theme.touchTarget");
    expect(chipBlock).toContain("accessibilityLabel={presetChipAccessibilityLabel(presetKrw)}");
    expect(chipBlock).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
