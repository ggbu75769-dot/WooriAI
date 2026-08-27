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
    expect(screen()).toContain("const itemHistory = buildItemHistory({");
    expect(screen()).toContain("{itemHistory ? (");
    expect(screen()).toContain("{itemHistory.scopeNotice}");
    expect(screen()).toContain("{itemHistory.title}");
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
    expect(screenSource.match(/setTimeout\(leaveAfterMutation, 650\)/g) ?? []).toHaveLength(2);
    expect(screenSource).not.toContain('setTimeout(() => router.replace("/(tabs)/records"), 650)');
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
