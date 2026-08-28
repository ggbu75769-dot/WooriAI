import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reconcileMonthlyExpenses } from "../offline/expense-list-reconciliation";
import type { LocalExpenseRow } from "../offline/types";
import type { ComparableExpenseRecord } from "./last-month-comparison";
import {
  evaluateWeeklySummary,
  WEEKLY_STREAK_EMPTY_NUDGE_TEXT,
  WEEKLY_STREAK_VIEW_ONLY_EMPTY_TEXT
} from "./weekly-summary";

/** 2026-08-27은 목요일 -- 이번 주는 08-24(월)~08-27, 지난주 같은 요일까지는 08-17~08-20. */
const THURSDAY = "2026-08-27";

function record(spentOn: string, amountKrw: number, expenseType = "expense"): ComparableExpenseRecord {
  return { spentOn, amountKrw, expenseType };
}

describe("UX-A 주간 요약 (월요일 시작)", () => {
  const thisWeek = [
    record("2026-08-24", 30_000),
    record("2026-08-25", 24_200),
    record("2026-08-26", 20_000),
    record("2026-08-27", 10_000)
  ];
  const lastWeek = [
    record("2026-08-17", 50_000),
    record("2026-08-19", 46_200),
    // 지난주지만 "같은 요일" 이후(금·일)라 비교 구간 밖이다.
    record("2026-08-21", 500_000),
    record("2026-08-23", 500_000)
  ];

  it("이번 주 합계와 지난주 같은 요일까지의 비교를 한 줄로 만든다", () => {
    const summary = evaluateWeeklySummary({
      todayIso: THURSDAY,
      thisMonthRecords: [...thisWeek, ...lastWeek],
      lastMonthRecords: []
    });

    expect(summary).toMatchObject({ weekStartIso: "2026-08-24", totalKrw: 84_200, recordedDayCount: 4 });
    expect(summary?.comparison).toMatchObject({ direction: "less", lastWeekToDateKrw: 96_200, differenceKrw: 12_000 });
    expect(summary?.text).toBe("이번 주 84,200원 · 지난주 같은 요일까지보다 12,000원 적게 썼어요");
    expect(summary?.streakText).toBe("이번 주 4일 기록했어요");
    expect(summary?.accessibilityLabel).toBe(
      "이번 주 84,200원 · 지난주 같은 요일까지보다 12,000원 적게 썼어요. 이번 주 4일 기록했어요"
    );
  });

  it("지난주보다 많이 쓴 주와 같은 주도 사실만 말한다", () => {
    const more = evaluateWeeklySummary({
      todayIso: THURSDAY,
      thisMonthRecords: [record("2026-08-24", 100_000), record("2026-08-17", 40_000)],
      lastMonthRecords: []
    });
    expect(more?.text).toBe("이번 주 100,000원 · 지난주 같은 요일까지보다 60,000원 많이 썼어요");

    const same = evaluateWeeklySummary({
      todayIso: THURSDAY,
      thisMonthRecords: [record("2026-08-24", 40_000), record("2026-08-17", 40_000)],
      lastMonthRecords: []
    });
    expect(same?.comparison?.direction).toBe("same");
    expect(same?.text).toBe("이번 주 40,000원 · 지난주 같은 요일까지와 같아요");
  });

  it("월요일에는 그날 하루만 이번 주다 (전날 일요일은 지난주)", () => {
    const summary = evaluateWeeklySummary({
      todayIso: "2026-08-24",
      thisMonthRecords: [record("2026-08-23", 90_000), record("2026-08-24", 12_000)],
      lastMonthRecords: []
    });
    expect(summary).toMatchObject({ weekStartIso: "2026-08-24", totalKrw: 12_000, recordedDayCount: 1 });
    // 지난주 같은 요일까지 = 08-17 하루뿐이고 기록이 없으므로 비교하지 않는다.
    expect(summary?.comparison).toBeNull();
    expect(summary?.text).toBe("이번 주 12,000원");
  });

  it("지난주 같은 시점까지 기록이 없으면 비교 문장을 만들지 않는다", () => {
    const summary = evaluateWeeklySummary({
      todayIso: THURSDAY,
      thisMonthRecords: [record("2026-08-25", 12_000)],
      lastMonthRecords: []
    });
    expect(summary?.comparison).toBeNull();
    expect(summary?.text).toBe("이번 주 12,000원");
  });
});

describe("UX-A 주간 요약 (달을 걸친 주)", () => {
  // 2026-09-01은 화요일 -- 이번 주 월요일은 8월 31일이라 이번 달 캐시만으로는 하루가 빠진다.
  const thisMonth = [record("2026-09-01", 10_000)];
  const lastMonth = [record("2026-08-31", 20_000), record("2026-08-24", 5_000), record("2026-08-25", 5_000)];

  it("지난달 캐시까지 합쳐 정확한 주 합계와 비교를 낸다", () => {
    const summary = evaluateWeeklySummary({
      todayIso: "2026-09-01",
      thisMonthRecords: thisMonth,
      lastMonthRecords: lastMonth
    });

    expect(summary).toMatchObject({ weekStartIso: "2026-08-31", totalKrw: 30_000, recordedDayCount: 2 });
    // 지난주 같은 요일까지 = 08-24(월)~08-25(화) = 10,000원.
    expect(summary?.comparison).toMatchObject({ direction: "more", lastWeekToDateKrw: 10_000, differenceKrw: 20_000 });
  });

  it("지난달 캐시가 아직 없으면 부분 합계에 '이번 주'라는 이름을 붙이지 않는다", () => {
    expect(
      evaluateWeeklySummary({ todayIso: "2026-09-01", thisMonthRecords: thisMonth, lastMonthRecords: null })
    ).toBeNull();
  });

  it("이번 주는 이번 달 안이지만 지난주가 지난달에 걸치면 비교만 생략한다", () => {
    // 2026-09-10(목)의 이번 주 월요일은 09-07, 지난주 구간은 08-31~09-03.
    const summary = evaluateWeeklySummary({
      todayIso: "2026-09-10",
      thisMonthRecords: [record("2026-09-08", 15_000)],
      lastMonthRecords: null
    });
    expect(summary).toMatchObject({ weekStartIso: "2026-09-07", totalKrw: 15_000 });
    expect(summary?.comparison).toBeNull();
    expect(summary?.text).toBe("이번 주 15,000원");
  });
});

describe("UX-A 기록 스트릭 · 금액 기준", () => {
  it("기록이 없는 주는 비난 없이 다음 한 걸음만 권한다", () => {
    const summary = evaluateWeeklySummary({ todayIso: THURSDAY, thisMonthRecords: [], lastMonthRecords: [] });
    expect(summary).toMatchObject({ totalKrw: 0, recordedDayCount: 0, comparison: null });
    expect(summary?.text).toBe("이번 주 지출은 아직 없어요");
    expect(summary?.streakText).toBe("이번 주 첫 기록을 남겨보세요");
  });

  /**
   * 라운드 41 K-5 — 잠긴(보기 전용) 세션의 진리표.
   *
   * 문제였던 자리: 가족이 기록한 보기 전용 홈은 첫 실행 안내가 뜨지 않으므로 주간 카드가
   * 그대로 뜨는데, 그 주에 기록이 아직 없으면 스트릭 줄이 "이번 주 첫 기록을 남겨보세요"라는
   * **지킬 수 없는 권유**를 되돌려줬다(눌러도 "기록은 관리자·공동부모가 남길 수 있어요"뿐).
   *
   * 바꾸는 것은 그 한 줄뿐이다 -- 합계·비교는 잠금과 무관하게 참이므로 그대로 둔다.
   */
  it("K-5: 기록 0일 + 잠김이면 권유 대신 중립 서술을 놓는다", () => {
    const input = { todayIso: THURSDAY, thisMonthRecords: [] as ComparableExpenseRecord[], lastMonthRecords: [] };

    expect(evaluateWeeklySummary({ ...input, expenseEntryLocked: false })?.streakText).toBe(
      WEEKLY_STREAK_EMPTY_NUDGE_TEXT
    );
    const locked = evaluateWeeklySummary({ ...input, expenseEntryLocked: true });
    expect(locked?.streakText).toBe(WEEKLY_STREAK_VIEW_ONLY_EMPTY_TEXT);
    expect(locked?.streakText).not.toContain("남겨보세요");
    // 소리로 듣는 문장도 같은 값에서 조립된다(두 번째 소스를 만들지 않는다).
    expect(locked?.accessibilityLabel).toBe(`이번 주 지출은 아직 없어요. ${WEEKLY_STREAK_VIEW_ONLY_EMPTY_TEXT}`);
  });

  it("K-5: 기록이 하루라도 있으면 그 문장은 이미 사실이라 잠금과 무관하게 그대로다", () => {
    const thisMonthRecords = [record("2026-08-25", 30_000), record("2026-08-26", 20_000)];
    for (const expenseEntryLocked of [true, false]) {
      const summary = evaluateWeeklySummary({
        todayIso: THURSDAY,
        thisMonthRecords,
        lastMonthRecords: [],
        expenseEntryLocked
      });
      expect(summary?.streakText).toBe("이번 주 2일 기록했어요");
    }
  });

  it("K-5: 카드 자체(합계·비교)는 잠긴 세션에도 그대로 있다 -- 접지 않는다", () => {
    const args = {
      todayIso: THURSDAY,
      thisMonthRecords: [record("2026-08-25", 30_000), record("2026-08-17", 50_000)],
      lastMonthRecords: []
    };
    const open = evaluateWeeklySummary({ ...args, expenseEntryLocked: false });
    const locked = evaluateWeeklySummary({ ...args, expenseEntryLocked: true });
    expect(locked).not.toBeNull();
    expect(locked?.totalKrw).toBe(open?.totalKrw);
    expect(locked?.text).toBe(open?.text);
    expect(locked?.comparison).toEqual(open?.comparison);
  });

  it("K-5: 인자를 넘기지 않으면 종전 동작 그대로다 (기본값 false)", () => {
    const before = evaluateWeeklySummary({ todayIso: THURSDAY, thisMonthRecords: [], lastMonthRecords: [] });
    expect(before?.streakText).toBe(WEEKLY_STREAK_EMPTY_NUDGE_TEXT);
  });

  it("합계는 선물·환불을 빼고(DNC-015) 세지만, 기록한 날은 그 행들도 센다", () => {
    const summary = evaluateWeeklySummary({
      todayIso: THURSDAY,
      thisMonthRecords: [
        record("2026-08-25", 50_000, "gift"),
        record("2026-08-26", 30_000, "refund"),
        record("2026-08-27", 10_000)
      ],
      lastMonthRecords: []
    });
    expect(summary).toMatchObject({ totalKrw: 10_000, recordedDayCount: 3 });
    expect(summary?.text).toBe("이번 주 10,000원");
  });

  it("선물만 기록한 주는 '지출 없음'이면서도 기록한 날을 인정한다", () => {
    const summary = evaluateWeeklySummary({
      todayIso: THURSDAY,
      thisMonthRecords: [record("2026-08-25", 50_000, "gift")],
      lastMonthRecords: []
    });
    expect(summary?.text).toBe("이번 주 지출은 아직 없어요");
    expect(summary?.streakText).toBe("이번 주 1일 기록했어요");
  });

  it("이번 달 캐시가 없거나 오늘 형식이 깨졌으면 아무것도 만들지 않는다", () => {
    expect(evaluateWeeklySummary({ todayIso: THURSDAY, thisMonthRecords: null, lastMonthRecords: [] })).toBeNull();
    expect(evaluateWeeklySummary({ todayIso: "오늘", thisMonthRecords: [], lastMonthRecords: [] })).toBeNull();
  });
});

/**
 * 라운드 33 F6: 홈(app/(tabs)/index.tsx)의 `reconciledMonthRecords` + 주간 요약 조합을 그대로
 * 재현한다. 화면은 vitest에서 렌더할 수 없으므로(이 저장소 관례) 같은 순수 함수 조합을 여기서
 * 조립해 "오프라인 대기 행이 주간 합계·스트릭에 반영되는가"를 실제 값으로 확인한다.
 */
type ServerExpenseRecord = { id: string; amountKrw: number; spentOn: string; expenseType: string };

function serverExpense(id: string, spentOn: string, amountKrw: number, expenseType = "expense"): ServerExpenseRecord {
  return { id, amountKrw, spentOn, expenseType };
}

function localRow(overrides: {
  localId: string;
  spentOn: string;
  amountKrw: number;
  canonicalId?: string | null;
  syncState?: LocalExpenseRow["syncState"];
  pendingDelete?: boolean;
  expenseType?: "expense" | "gift";
}): LocalExpenseRow {
  return {
    localId: overrides.localId,
    canonicalId: overrides.canonicalId ?? null,
    childId: "child-1",
    payload: {
      childId: "child-1",
      categoryId: "cat-1",
      amountKrw: overrides.amountKrw,
      spentOn: overrides.spentOn,
      itemName: "기저귀",
      ...(overrides.expenseType ? { expenseType: overrides.expenseType } : {})
    },
    version: null,
    syncState: overrides.syncState ?? "pending",
    pendingDelete: overrides.pendingDelete ?? false,
    conflictCurrent: null,
    lastError: null,
    createdAt: `${overrides.spentOn}T00:00:00.000Z`,
    updatedAt: `${overrides.spentOn}T00:00:00.000Z`
  };
}

/** app/(tabs)/index.tsx의 reconciledMonthRecords와 같은 계산. */
function reconciledMonthRecords(
  serverExpenses: ServerExpenseRecord[],
  offlineRows: LocalExpenseRow[],
  yearMonth: string
): ComparableExpenseRecord[] {
  const reconciled = reconcileMonthlyExpenses(serverExpenses, offlineRows, yearMonth);
  return [
    ...reconciled.visibleServerExpenses,
    ...reconciled.offlinePendingRows.map((row) => ({
      amountKrw: row.payload.amountKrw,
      spentOn: row.payload.spentOn,
      expenseType: row.payload.expenseType
    }))
  ];
}

function homeWeeklySummary(input: {
  todayIso?: string;
  thisMonthServer?: ServerExpenseRecord[];
  lastMonthServer?: ServerExpenseRecord[];
  offlineRows?: LocalExpenseRow[];
}) {
  const todayIso = input.todayIso ?? THURSDAY;
  const offlineRows = input.offlineRows ?? [];
  return evaluateWeeklySummary({
    todayIso,
    thisMonthRecords: reconciledMonthRecords(input.thisMonthServer ?? [], offlineRows, todayIso.slice(0, 7)),
    lastMonthRecords: reconciledMonthRecords(input.lastMonthServer ?? [], offlineRows, "2026-07")
  });
}

describe("F6 주간 요약 · 오프라인 재조정", () => {
  it("아직 서버에 못 올라간 오프라인 기록이 이번 주 합계와 스트릭에 들어간다", () => {
    const serverOnly = homeWeeklySummary({ thisMonthServer: [serverExpense("s1", "2026-08-24", 30_000)] });
    expect(serverOnly).toMatchObject({ totalKrw: 30_000, recordedDayCount: 1 });

    const withOffline = homeWeeklySummary({
      thisMonthServer: [serverExpense("s1", "2026-08-24", 30_000)],
      offlineRows: [localRow({ localId: "local-1", spentOn: "2026-08-27", amountKrw: 12_000 })]
    });
    // 방금 오프라인으로 기록한 12,000원이 빠지면 홈이 "이번 주 30,000원 · 1일"이라고 말한다.
    expect(withOffline).toMatchObject({ totalKrw: 42_000, recordedDayCount: 2 });
    expect(withOffline?.streakText).toBe("이번 주 2일 기록했어요");
  });

  it("오프라인 기록만 있는 주에도 '첫 기록을 남겨보세요'라고 말하지 않는다", () => {
    const summary = homeWeeklySummary({
      offlineRows: [localRow({ localId: "local-1", spentOn: "2026-08-25", amountKrw: 8_000 })]
    });
    expect(summary?.streakText).toBe("이번 주 1일 기록했어요");
    expect(summary?.text).toBe("이번 주 8,000원");
  });

  it("로컬에서 수정 대기 중인 서버 행은 낡은 값이 아니라 수정값으로 센다 (중복 계상 없음)", () => {
    const summary = homeWeeklySummary({
      thisMonthServer: [serverExpense("s1", "2026-08-24", 30_000)],
      offlineRows: [
        localRow({ localId: "local-1", canonicalId: "s1", spentOn: "2026-08-24", amountKrw: 5_000 })
      ]
    });
    expect(summary).toMatchObject({ totalKrw: 5_000, recordedDayCount: 1 });
  });

  it("삭제 대기 중인 행은 합계에서 빠진다", () => {
    const summary = homeWeeklySummary({
      thisMonthServer: [serverExpense("s1", "2026-08-24", 30_000), serverExpense("s2", "2026-08-25", 7_000)],
      offlineRows: [
        localRow({ localId: "local-1", canonicalId: "s1", spentOn: "2026-08-24", amountKrw: 30_000, pendingDelete: true })
      ]
    });
    expect(summary).toMatchObject({ totalKrw: 7_000, recordedDayCount: 1 });
  });

  it("동기화가 끝난 로컬 행은 서버 목록으로만 세어 두 번 더해지지 않는다", () => {
    const summary = homeWeeklySummary({
      thisMonthServer: [serverExpense("s1", "2026-08-24", 30_000)],
      offlineRows: [
        localRow({ localId: "local-1", canonicalId: "s1", spentOn: "2026-08-24", amountKrw: 30_000, syncState: "synced" })
      ]
    });
    expect(summary).toMatchObject({ totalKrw: 30_000, recordedDayCount: 1 });
  });

  it("오프라인 선물 행은 합계에서 빠지고 기록한 날로만 센다 (DNC-015)", () => {
    const summary = homeWeeklySummary({
      offlineRows: [localRow({ localId: "local-1", spentOn: "2026-08-26", amountKrw: 50_000, expenseType: "gift" })]
    });
    expect(summary).toMatchObject({ totalKrw: 0, recordedDayCount: 1 });
    expect(summary?.text).toBe("이번 주 지출은 아직 없어요");
  });

  it("지난주 비교의 기준액에도 같은 재조정이 걸린다 (한쪽만 반영되면 허위 비교)", () => {
    const summary = homeWeeklySummary({
      thisMonthServer: [serverExpense("s1", "2026-08-24", 30_000)],
      offlineRows: [localRow({ localId: "local-1", spentOn: "2026-08-17", amountKrw: 50_000 })]
    });
    expect(summary?.comparison).toMatchObject({ direction: "less", lastWeekToDateKrw: 50_000, differenceKrw: 20_000 });
  });
});

describe("UX-A 주간 요약 화면 배선 계약 (app/(tabs)/index.tsx)", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
  const recordsSource = readFileSync(join(process.cwd(), "app/(tabs)/records.tsx"), "utf8");

  it("이번 달 지출은 기록 탭과 같은 캐시 키를 쓰고 전량 수집 페처를 거친다", () => {
    expect(homeSource).toContain('queryKey: ["expenses", childId, thisYearMonth]');
    expect(homeSource).toContain(
      "fetchMonthExpenses((page) => listExpenses(authToken!, childId!, thisYearMonth, page))"
    );
    // 키 모양이 기록 탭과 같아야 두 화면이 같은 응답을 공유한다.
    expect(recordsSource).toContain('queryKey: ["expenses", childId, recordsYearMonth]');
  });

  it("세션이 있을 때만 계산하고 두 달치 캐시를 함께 넘긴다", () => {
    expect(homeSource).toContain("const weeklySummary = hasSession");
    expect(homeSource).toContain("thisMonthRecords: weeklyThisMonthRecords");
    expect(homeSource).toContain("lastMonthRecords: weeklyLastMonthRecords");
  });

  it("K-5: 잠금 판정을 순수 모듈에 넘기고, 카드 게이트 자체는 건드리지 않는다", () => {
    // 문구 갈래는 순수 모듈이 고른다 -- 화면이 잠긴 세션용 문장을 따로 들지 않는다.
    expect(homeSource).toContain("expenseEntryLocked: expenseGate.locked");
    // 잠긴 세션용 문장을 화면이 따로 들지 않는다 -- 스트릭 줄은 순수 모듈의 값을 그대로 꽂는다
    // (기존 권유 문구는 J-5 주석에서 사례로만 언급된다).
    expect(homeSource).not.toContain('"이번 주 기록이 아직 없어요"');
    expect(homeSource).toContain("<Text style={homeWeeklySummaryStyle.streak}>{weeklySummary.streakText}</Text>");
    // 잠금이 바뀌면 값이 다시 계산돼야 문구가 따라간다.
    expect(homeSource).toContain("weeklyLastMonthRecords, expenseGate.locked]");
    // 카드를 그릴지의 게이트는 종전 그대로다(잠겼다고 카드를 접지 않는다).
    expect(homeSource).toContain(
      "const weeklySummary = hasSession && !homeGuideSpeaksForEmptyHome(firstRunGuide?.variant) ? weeklySpend : null;"
    );
  });

  /**
   * 라운드 33 F6: 서버 목록만 더하면 오프라인에서 기록해 아직 올라가지 않은 행이 주간 합계·
   * 스트릭에서 통째로 빠진다(방금 기록했는데 홈은 "이번 주 첫 기록을 남겨보세요"라고 말한다).
   * 기록 탭이 이미 쓰는 reconcileMonthlyExpenses를 **같은 함수로** 거쳐서 넘긴다.
   */
  it("F6: 두 달치 모두 기록 탭과 같은 오프라인 재조정을 거친다", () => {
    expect(homeSource).toContain(
      'import { reconcileMonthlyExpenses } from "../../src/offline/expense-list-reconciliation";'
    );
    expect(homeSource).toContain("reconciledMonthRecords(thisMonthExpenses.data?.expenses, childOfflineRows, thisYearMonth)");
    expect(homeSource).toContain("reconciledMonthRecords(lastMonthExpenses.data?.expenses, childOfflineRows, lastYearMonth)");
    // 재조정 대상은 선택된 아이의 행뿐이다(기록 탭과 같은 필터).
    expect(homeSource).toContain("offlineSyncSnapshot.rows.filter((row) => row.childId === childId)");
    expect(recordsSource).toContain("reconcileMonthlyExpenses(serverExpenses ?? [], childOfflineRows, recordsYearMonth)");
  });

  it("라운드 51 #7: REP-121 전월 비교 한 줄도 두 항이 같은 재조정을 거친다", () => {
    // F6은 이 줄을 종전 경로(서버 목록 원본)로 남겼다 -- "그 줄의 이번 달 항은 /home 서버
    // 집계라, 지난달 항만 재조정하면 두 항의 규칙이 갈린다"는 이유였다(별건으로 남김).
    // 라운드 51 #7이 이번 달 항(`monthlyUsed`)을 재조정 값으로 바꿨으므로, 지난달 항을 그대로
    // 두면 **비대칭이 반대로 뒤집힌다**(이번 달 대기 행만 세는 비교). 두 항 모두 주간 카드가
    // 이미 만든 재조정 결과를 쓴다 -- 새 요청은 늘지 않는다(같은 캐시·같은 함수).
    expect(homeSource).toContain("lastMonthRecords: weeklyLastMonthRecords");
    expect(homeSource).toContain("thisMonthToDateKrw: monthlyUsed");
    expect(homeSource).toContain("resolveThisMonthUsedKrw({");
  });

  it("카드에 소리용 라벨이 붙고 장식 글리프는 접근성 트리에서 감춰진다", () => {
    expect(homeSource).toContain("accessibilityLabel={weeklySummary.accessibilityLabel}");
    expect(homeSource).toContain('testID="home-weekly-summary"');
    // D1 후속(실기기 피드백 2): 장식 글리프(▦)는 Ionicons로 바뀌었지만 "접근성 트리에서
    // 감춘다"는 계약은 그대로다 -- 색·크기도 같은 스타일 토큰에서 그대로 읽어 쓴다.
    expect(homeSource).toContain("accessible={false}\n                  name=\"calendar-outline\"");
    expect(homeSource).toContain("size={homeWeeklySummaryStyle.glyph.fontSize}");
    expect(homeSource).toContain("color={homeWeeklySummaryStyle.glyph.color}");
  });
});
