import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  evaluateHomeNotifications,
  monthlyWrapupDedupeKey,
  monthlyWrapupNotification,
  yearMonthFromMonthlyWrapupDedupeKey
} from "./generators";
import { SEOUL_UTC_OFFSET_MS } from "./iso-week";
import { notificationTapRoute } from "./notification-route";
import {
  NOTIFICATION_TYPE_OPTIONS,
  notificationTypeLabel,
  useNotificationPreferencesStore
} from "./notification-preferences.store";
import { useNotificationStore } from "./notification.store";
import {
  REPORTS_MONTH_NONCE_PARAM,
  REPORTS_MONTH_PARAM,
  REPORTS_TAB_PATHNAME,
  resolveReportsMonthLandingNonceParam,
  resolveReportsMonthLandingParam
} from "../reports/month-landing";
import { shareTotalLine } from "../reports/share-text";

/**
 * GAP-066 #8 — 지난달 정리(monthly_wrapup).
 *
 * 고정하는 계약 넷:
 *  1. 달이 바뀐 뒤 **한 번만** 뜬다(dedupeKey가 지난달을 담는다) — 다음 달에 다시 무장한다.
 *  2. 지난달 합계가 0원이면 **만들지 않는다**(주간 요약의 0원 규칙 그대로 — 0원 요약은 소음이다).
 *  3. 눌러서 **그 달** 리포트에 착지한다(트랙 A의 달 착지 규약을 부르기만 한다).
 *  4. 끄면 다음 달에 오지 않고, 끈 동안에는 dedupeKey를 소모하지 않는다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** 서울(KST) 달력의 그 날짜·시각에 해당하는 epoch ms. */
const kst = (year: number, month1: number, day: number, hour = 12, minute = 0) =>
  Date.UTC(year, month1 - 1, day, hour, minute) - SEOUL_UTC_OFFSET_MS;

/** 2026-08-03(월) KST — 8월 초, 즉 7월이 막 끝난 시점. */
const NOW = kst(2026, 8, 3);

/** 지난달(2026-07) 캐시 행 — `["expenses", childId, "2026-07"]` 응답 모양의 최소치. */
const julyRecords = [
  { amountKrw: 84_200, spentOn: "2026-07-02", expenseType: "expense" },
  { amountKrw: 1_161_500, spentOn: "2026-07-28", expenseType: "expense" }
];
const JULY_TOTAL_KRW = 1_245_700;

describe("GAP-066 #8 monthly_wrapup 발화 규칙", () => {
  it("지난달 합계를 그 달의 이름으로 말한다 (문구는 공유 카드가 이미 쓰는 문장 그대로)", () => {
    const candidate = monthlyWrapupNotification({
      childId: "child-1",
      now: NOW,
      lastMonthRecords: julyRecords
    });
    expect(candidate).toEqual({
      type: "monthly_wrapup",
      title: "7월 함께한 지출 1,245,700원",
      body: "리포트 탭에서 7월을 함께 확인해볼까요?",
      dedupeKey: "monthly_wrapup:child-1:2026-07",
      childId: "child-1"
    });
    // 금액 줄을 여기서 다시 만들지 않는다 -- 공유 카드와 같은 함수를 지난다(새 어휘 금지).
    expect(candidate!.title).toContain(shareTotalLine(JULY_TOTAL_KRW));
    // 시점어("지난달"·"이번 달")를 쓰지 않는다: 알림은 목록에 얼어붙는 스냅숏이라, 한 달 뒤에도
    // 참인 문장이어야 한다(record_gap이 라운드 54 P1-3에서 내린 것과 같은 판단).
    for (const word of ["지난달", "이번 달", "오늘", "지금"]) {
      expect(candidate!.title, word).not.toContain(word);
      expect(candidate!.body, word).not.toContain(word);
    }
  });

  it("지난달이 0원이면 만들지 않는다 (0원 요약은 소음이다)", () => {
    expect(monthlyWrapupNotification({ childId: "child-1", now: NOW, lastMonthRecords: [] })).toBeNull();
    // 선물·환불만 있는 달도 0원이다 -- 합산 술어는 월 합계와 같은 한 곳에서 온다(DNC-015).
    expect(
      monthlyWrapupNotification({
        childId: "child-1",
        now: NOW,
        lastMonthRecords: [
          { amountKrw: 50_000, spentOn: "2026-07-10", expenseType: "gift" },
          { amountKrw: 20_000, spentOn: "2026-07-11", expenseType: "refund" }
        ]
      })
    ).toBeNull();
  });

  it("지난달 캐시가 아직 없으면 만들지 않는다 (판정 불가 -- 키를 태우지 않는다)", () => {
    expect(monthlyWrapupNotification({ childId: "child-1", now: NOW })).toBeNull();
    expect(monthlyWrapupNotification({ childId: "child-1", now: NOW, lastMonthRecords: null })).toBeNull();
  });

  /**
   * record_gap이 라운드 54 P1-3에서 내린 것과 같은 판단: 서버 스냅숏이 이 기기가 아는 사실을
   * 아직 모르는 동안에는 **금액을 단언하지 않는다**. 로컬로만 적어 온 지출이 빠진 합계를 알림에
   * 얼려 두면, 사용자가 그 자리에서 반박할 수 있는 숫자가 목록에 남는다.
   */
  it("이 기기에 미동기화 지출 행이 있으면 만들지 않는다", () => {
    const base = { childId: "child-1", now: NOW, lastMonthRecords: julyRecords };
    expect(monthlyWrapupNotification(base)).not.toBeNull();
    expect(monthlyWrapupNotification({ ...base, hasPendingLocalRecords: true })).toBeNull();
    // 억제는 그 달의 키를 소모하지 않는다(아래 스토어 통합 테스트가 값으로 확인한다).
  });

  it("다른 달 행이 섞여 들어와도 그 달만 센다", () => {
    const candidate = monthlyWrapupNotification({
      childId: "child-1",
      now: NOW,
      lastMonthRecords: [
        ...julyRecords,
        { amountKrw: 999_000, spentOn: "2026-08-01", expenseType: "expense" },
        { amountKrw: 777_000, spentOn: "2026-06-30", expenseType: "expense" }
      ]
    });
    expect(candidate!.title).toBe("7월 함께한 지출 1,245,700원");
  });

  it("달 경계는 **서울 달력**이다 (기기 시각이 아니라)", () => {
    // KST 8월 1일 00:30 = UTC 7월 31일 15:30. 기기가 UTC로 판정하면 "지난달"이 6월이 된다.
    const justAfterMidnight = kst(2026, 8, 1, 0, 30);
    expect(
      monthlyWrapupNotification({ childId: "child-1", now: justAfterMidnight, lastMonthRecords: julyRecords })!
        .dedupeKey
    ).toBe("monthly_wrapup:child-1:2026-07");
    // KST 7월 31일 23:30에는 아직 7월이라, 지난달은 6월이다(7월을 정리하지 않는다).
    expect(
      monthlyWrapupNotification({
        childId: "child-1",
        now: kst(2026, 7, 31, 23, 30),
        lastMonthRecords: julyRecords
      })
    ).toBeNull();
  });

  it("해가 바뀌는 경계: 1월의 지난달은 전년 12월이다", () => {
    const candidate = monthlyWrapupNotification({
      childId: "child-1",
      now: kst(2027, 1, 2),
      lastMonthRecords: [{ amountKrw: 300_000, spentOn: "2026-12-24", expenseType: "expense" }]
    });
    expect(candidate!.dedupeKey).toBe("monthly_wrapup:child-1:2026-12");
    expect(candidate!.title).toBe("12월 함께한 지출 300,000원");
  });

  it("dedupeKey는 **그 알림이 말하는 달**을 담고, 목적지가 그것을 되읽는다", () => {
    expect(monthlyWrapupDedupeKey("child-1", "2026-07")).toBe("monthly_wrapup:child-1:2026-07");
    expect(yearMonthFromMonthlyWrapupDedupeKey("monthly_wrapup:child-1:2026-07")).toBe("2026-07");
    // childId에 ":"가 들어 있어도 안전하다(마지막 조각을 본다).
    expect(yearMonthFromMonthlyWrapupDedupeKey("monthly_wrapup:child:1:2026-07")).toBe("2026-07");
    // 형식이 어긋난 저장본은 달을 지어내지 않는다.
    for (const bad of [
      "monthly_wrapup:child-1:2026-13",
      "monthly_wrapup:child-1:2026",
      "monthly_wrapup:child-1",
      "record_gap:child-1:2026-W34",
      ""
    ]) {
      expect(yearMonthFromMonthlyWrapupDedupeKey(bad), bad).toBeNull();
    }
  });
});

describe("GAP-066 #8 홈 평가 합류 (새 요청 0건)", () => {
  const home = {
    child: { id: "child-1", nickname: "다온이", stageLabel: "24개월" },
    monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 0 },
    lastSeenStageLabel: "24개월",
    followupEntries: [],
    now: NOW,
    weekly: null
  };

  it("같은 평가 한 번에 다른 알림들과 함께 만들어진다", () => {
    const candidates = evaluateHomeNotifications({ ...home, lastMonthRecords: julyRecords });
    expect(candidates.map((candidate) => candidate.type)).toEqual(["monthly_wrapup"]);
    expect(candidates[0].dedupeKey).toBe("monthly_wrapup:child-1:2026-07");
  });

  it("지난달 캐시를 넘기지 않는 호출부에서는 종전과 한 글자도 다르지 않다", () => {
    expect(evaluateHomeNotifications(home).map((candidate) => candidate.type)).toEqual([]);
  });

  /**
   * 판정에 쓰는 지난달 합계는 **홈이 이미 받아 둔 쿼리 결과**에서만 온다(NOTI-103: 알림을 위해
   * 새 요청을 내지 않는다).
   *
   * 라운드 66 적대 리뷰(S-2)로 전달 방식이 바뀌었다: 훅이 `getQueryData`로 **명령형으로 읽던**
   * 값을 이제 **인자로 받아 effect의 deps에 둔다.** 명령형 읽기는 deps에 잡히지 않아 "캐시가
   * 도착했다"는 사실만으로는 재평가가 일어나지 않았고, 달을 걸치지 않는 주(= 대부분의 주)에는
   * `weekly`도 함께 바뀌지 않아 지난달 정리가 다음 렌더까지 미뤄졌다.
   */
  it("훅이 지난달 값을 **인자로** 받는다 -- deps에 있고, 새 쿼리도 새 요청도 없다", () => {
    const hookSource = source("src/notifications/useHomeNotificationEvaluation.ts");
    // 명령형 캐시 읽기는 남아 있지 않다(그 자리가 재평가 누락 창을 만들었다).
    expect(hookSource).not.toContain("getQueryData");
    expect(hookSource).not.toContain("useQueryClient");
    expect(hookSource).toContain("lastMonthExpenses: Expense[] | undefined");
    expect(hookSource).toContain("lastMonthRecords");
    // 값이 실제로 deps에 있다 -- 도착 자체가 재평가를 깨운다.
    // 라운드 79 리뷰(M-3): 인자가 여섯이 되며 deps가 여러 줄로 나뉘었다 -- 바이트가 아니라
    // **그 배열에 무엇이 들어 있는가**를 묻는다(실재 확인을 함께 세운다 -- 라운드 78 E).
    const depsAt = hookSource.lastIndexOf("  }, [");
    expect(depsAt, "평가 effect의 의존 배열").toBeGreaterThan(-1);
    const depsEnd = hookSource.indexOf("]);", depsAt);
    expect(depsEnd, "의존 배열의 끝").toBeGreaterThan(depsAt);
    const deps = hookSource.slice(depsAt, depsEnd);
    for (const dep of [
      "home",
      "weekly",
      // 라운드 80 B: 그 자리는 boolean이 아니라 **스냅샷 행**이 됐다(범위로 좁혀 세기 위해서다).
      "pendingRecordRows",
      "lastMonthYearMonth",
      "lastMonthExpenses",
      "hasRecoverablePendingMonthRecords"
    ]) {
      expect(deps, `${dep}가 deps에 있다`).toContain(dep);
    }
    // 읽기 전용이다: 이 훅은 쿼리를 만들지도, 무효화하지도 않는다.
    expect(hookSource).not.toContain("useQuery(");
    expect(hookSource).not.toContain("invalidateQueries");
    // 달 경계는 한 순간에서만 나온다(자정 근처에 캐시의 달과 문구의 달이 갈리지 않게).
    expect(hookSource).toContain("const nowMs = Date.now();");
    expect(hookSource).toContain("const lastYearMonth = previousYearMonth(seoulCalendarDate(nowMs));");
    expect(hookSource).toContain("now: nowMs");
    // 넘겨받은 배열이 **다른 달**의 것이면 쓰지 않는다(자정을 갓 넘긴 렌더).
    expect(hookSource).toContain("lastYearMonth === lastMonthYearMonth");
    // 홈 화면은 **이미 조회 중인 쿼리**의 결과를 넘긴다 -- 새 쿼리를 만들지 않는다.
    const homeSource = source("app/(tabs)/index.tsx");
    // 라운드 79 리뷰(M-3): 뒤에 인자가 하나 더 붙었다 — 이 단언이 묻는 것은 그대로다
    // (지난달 쿼리의 결과가 **인자로** 넘어간다).
    expect(homeSource).toContain("    lastYearMonth,\n    lastMonthExpenses.data?.expenses,\n");
    // 지난달 쿼리는 이 화면에 **하나뿐**이다(나머지 한 자리는 당겨서 새로고침의 무효화다).
    expect(homeSource.match(/useQuery\(\{\n\s+queryKey: \["expenses", childId, lastYearMonth\]/g) ?? []).toHaveLength(
      1
    );
  });
});

describe("GAP-066 #8 목적지: 그 달의 리포트", () => {
  const entry = { type: "monthly_wrapup", dedupeKey: "monthly_wrapup:child-1:2026-07" } as const;
  const TODAY = "2026-08-03";

  it("리포트 탭 + 그 달 + 이번 탭의 회차를 싣는다", () => {
    expect(notificationTapRoute(entry, 7, TODAY)).toEqual({
      pathname: REPORTS_TAB_PATHNAME,
      params: { [REPORTS_MONTH_PARAM]: "2026-07", [REPORTS_MONTH_NONCE_PARAM]: "7" }
    });
    // 링크를 만드는 쪽과 읽는 쪽이 같은 규약을 쓴다(파라미터를 두 번 적지 않는다).
    // 리포트 탭의 착지 effect가 하는 것과 같은 좁히기: 문자열 목적지도, 기록 탭 목적지도 아니다.
    const route = notificationTapRoute(entry, 8, TODAY);
    if (typeof route === "string" || route.pathname !== REPORTS_TAB_PATHNAME) {
      throw new Error(`리포트 달 착지가 아니다: ${JSON.stringify(route)}`);
    }
    expect(resolveReportsMonthLandingParam(route.params[REPORTS_MONTH_PARAM])).toBe("2026-07");
    expect(resolveReportsMonthLandingNonceParam(route.params[REPORTS_MONTH_NONCE_PARAM])).toBe("8");
  });

  /**
   * 같은 알림을 두 번 눌러도 두 번 다 그 달로 간다: 리포트 탭은 계속 마운트된 채 남으므로
   * 값 단위 가드만 있으면 두 번째 탭이 "지난번과 같은 달"로 걸러진다(트랙 A가 달 착지 규약에
   * 회차를 함께 둔 이유 — record_gap이 라운드 57 QA에서 겪은 그 증상이다).
   */
  it("두 번째 탭도 다시 착지한다 (회차가 매번 다르다)", () => {
    const first = notificationTapRoute(entry, 1, TODAY);
    const second = notificationTapRoute(entry, 2, TODAY);
    expect(typeof first === "string" || typeof second === "string").toBe(false);
    expect((first as { params: Record<string, string> }).params[REPORTS_MONTH_NONCE_PARAM]).toBe("1");
    expect((second as { params: Record<string, string> }).params[REPORTS_MONTH_NONCE_PARAM]).toBe("2");
  });

  /**
   * 달을 만들 수 없으면 **달 없이** 리포트 탭으로 간다. 틀린 달에 내려놓는 것보다 낫고, 예전
   * 폴백(준비템 목록)보다도 낫다 — 그 화면은 이 알림이 말한 사실과 아무 관계가 없다.
   */
  it("달을 만들 수 없으면 달 없이 리포트 탭으로 간다 (준비템 목록으로 떨어지지 않는다)", () => {
    // 오늘을 모른다(회차만 있다).
    expect(notificationTapRoute(entry, 3)).toBe(REPORTS_TAB_PATHNAME);
    // 회차가 없다/형식이 어긋난다.
    expect(notificationTapRoute(entry, undefined, TODAY)).toBe(REPORTS_TAB_PATHNAME);
    expect(notificationTapRoute(entry, -1, TODAY)).toBe(REPORTS_TAB_PATHNAME);
    // 손상된 저장본의 달.
    expect(notificationTapRoute({ type: "monthly_wrapup", dedupeKey: "monthly_wrapup" }, 3, TODAY)).toBe(
      REPORTS_TAB_PATHNAME
    );
    // 미래 달·20년보다 먼 과거는 규약 모듈이 막는다(리포트 탭이 어차피 이번 달로 떨어뜨린다).
    expect(
      notificationTapRoute({ type: "monthly_wrapup", dedupeKey: "monthly_wrapup:child-1:2026-09" }, 3, TODAY)
    ).toBe(REPORTS_TAB_PATHNAME);
    expect(
      notificationTapRoute({ type: "monthly_wrapup", dedupeKey: "monthly_wrapup:child-1:1999-01" }, 3, TODAY)
    ).toBe(REPORTS_TAB_PATHNAME);
  });

  it("다른 여섯 종류의 목적지는 한 글자도 바뀌지 않는다", () => {
    expect(notificationTapRoute({ type: "budget_80", dedupeKey: "budget_80:child-1:2026-08" }, 3, TODAY)).toBe(
      "/budget"
    );
    expect(notificationTapRoute({ type: "budget_100", dedupeKey: "budget_100:child-1:2026-08" }, 3, TODAY)).toBe(
      "/budget"
    );
    expect(
      notificationTapRoute({ type: "weekly_summary", dedupeKey: "weekly_summary:child-1:2026-W31" }, 3, TODAY)
    ).toBe("/(tabs)/records");
    expect(notificationTapRoute({ type: "stage_transition", dedupeKey: "stage_transition:child-1:24개월" }, 3, TODAY)).toBe(
      "/(tabs)/items"
    );
    expect(
      notificationTapRoute({ type: "purchase_pending", dedupeKey: "purchase_pending:item-diaper:1700000000000" }, 3, TODAY)
    ).toBe("/items/item-diaper");
    expect(notificationTapRoute({ type: "record_gap", dedupeKey: "record_gap:child-1:2026-W31" }, 3, TODAY)).toEqual({
      pathname: "/(tabs)/records",
      params: { view: "calendar", viewNonce: "3" }
    });
  });

  it("화면이 목적지 판정에 서울 오늘을 넘긴다 (판정은 여전히 순수 함수 안에 있다)", () => {
    const screenSource = source("app/notifications.tsx");
    expect(screenSource).toContain('import { getSeoulToday } from "@wooriai/domain";');
    expect(screenSource).toContain("router.push(notificationTapRoute(entry, nextRecordsViewNonce(), getSeoulToday()));");
    // 착지 파라미터 이름·형식을 화면이 다시 적지 않는다(규약은 month-landing.ts 하나뿐이다).
    expect(screenSource).not.toContain("monthJump");
    expect(screenSource).toContain('monthly_wrapup: "calendar-outline"');
    // 목적지 판정 쪽도 규약을 손으로 다시 적지 않고 트랙 A의 빌더를 부르기만 한다.
    const routeSource = source("src/notifications/notification-route.ts");
    expect(routeSource).toContain('} from "../reports/month-landing";');
    expect(routeSource).toContain("buildReportsMonthLandingTarget({ yearMonth, nonce: viewNonce as number, todayIso })");
  });
});

describe("GAP-066 #8 스토어 통합: 달 1회 · 끄기 · 저장본", () => {
  const ingest = (now: number, lastMonthRecords: typeof julyRecords | null) =>
    useNotificationStore.getState().ingest(
      evaluateHomeNotifications({
        child: { id: "child-1", nickname: "다온이", stageLabel: "24개월" },
        monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 0 },
        lastSeenStageLabel: "24개월",
        followupEntries: [],
        now,
        weekly: null,
        lastMonthRecords
      }),
      now
    );
  const wrapupEntries = () =>
    useNotificationStore.getState().entries.filter((entry) => entry.type === "monthly_wrapup");

  beforeEach(() => {
    useNotificationStore.getState().resetAll();
    useNotificationPreferencesStore.getState().enableAll();
  });

  it("달이 바뀌고 처음 평가할 때 한 번만 뜨고, 다음 달에 다시 무장한다", () => {
    ingest(NOW, julyRecords);
    expect(wrapupEntries()).toHaveLength(1);
    expect(wrapupEntries()[0].title).toBe("7월 함께한 지출 1,245,700원");

    // 같은 달의 재평가(앱을 몇 번 더 열어도)는 아무것도 늘리지 않는다.
    ingest(kst(2026, 8, 9), julyRecords);
    ingest(kst(2026, 8, 27), julyRecords);
    expect(wrapupEntries()).toHaveLength(1);

    // 9월이 되면 8월분으로 한 번 더 뜬다(키가 갈린다).
    ingest(kst(2026, 9, 1), [{ amountKrw: 500_000, spentOn: "2026-08-11", expenseType: "expense" }]);
    expect(wrapupEntries().map((entry) => entry.title)).toEqual([
      "8월 함께한 지출 500,000원",
      "7월 함께한 지출 1,245,700원"
    ]);
  });

  it("설정에서 끄면 오지 않고, 끈 동안에는 dedupeKey를 소모하지 않는다", () => {
    useNotificationPreferencesStore.getState().setTypeEnabled("monthly_wrapup", false);
    ingest(NOW, julyRecords);
    expect(wrapupEntries()).toEqual([]);
    expect(useNotificationStore.getState().seenDedupeKeys).not.toContain("monthly_wrapup:child-1:2026-07");

    // 다시 켜면 같은 달에도 평소대로 발화한다("끄기"가 "영구 삭제"가 되지 않는다).
    useNotificationPreferencesStore.getState().setTypeEnabled("monthly_wrapup", true);
    ingest(kst(2026, 8, 9), julyRecords);
    expect(wrapupEntries()).toHaveLength(1);
  });

  it("미동기화 행 때문에 침묵한 달도 키를 태우지 않는다 (동기화 뒤 그 달 안에 뜬다)", () => {
    useNotificationStore.getState().ingest(
      evaluateHomeNotifications({
        child: { id: "child-1", nickname: "다온이", stageLabel: "24개월" },
        monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 0 },
        lastSeenStageLabel: "24개월",
        followupEntries: [],
        now: NOW,
        weekly: null,
        lastMonthRecords: julyRecords,
        hasPendingLocalRecords: true
      }),
      NOW
    );
    expect(wrapupEntries()).toEqual([]);
    expect(useNotificationStore.getState().seenDedupeKeys).not.toContain("monthly_wrapup:child-1:2026-07");
    ingest(kst(2026, 8, 4), julyRecords);
    expect(wrapupEntries()).toHaveLength(1);
  });

  it("설정 목록에 이름이 있고, 저장본 검증이 이 종류를 살려 둔다", () => {
    expect(NOTIFICATION_TYPE_OPTIONS.some((option) => option.type === "monthly_wrapup")).toBe(true);
    expect(notificationTypeLabel("monthly_wrapup")).toBe("지난달 정리 알림");

    ingest(NOW, julyRecords);
    const stored = useNotificationStore.getState().entries;
    const storeSource = source("src/notifications/notification.store.ts");
    // 저장본 검증 목록이 이 종류를 알아야 앱을 다시 열었을 때 목록에 남는다(마이그레이션은 없다 --
    // 항목의 필드 모양이 한 칸도 바뀌지 않았다).
    expect(storeSource).toContain('"monthly_wrapup"');
    expect(storeSource).toContain("version: 1");
    expect(stored[0].childId).toBe("child-1");
  });
});
