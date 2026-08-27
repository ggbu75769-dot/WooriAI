import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { evaluateHomeNotifications, resolveWeeklySpendForNotification } from "../notifications/generators";
import { SEOUL_UTC_OFFSET_MS } from "../notifications/iso-week";
import { useNotificationStore } from "../notifications/notification.store";
import { evaluateWeeklySummary } from "./weekly-summary";

/**
 * UX-W(C8) — 홈 콜드 스타트의 요청 구성 계약.
 *
 * 문제: 홈은 세션만 있으면 이번 달·지난달 지출을 **동시에** 커서 루프로 전량 조회했다
 * (fetchMonthExpenses, 한 달이 수백 건이면 여러 왕복). 그런데 지난달 데이터를 지금 필요로 하는
 * 소비자는 홈의 두 곳뿐이고 둘 다 "완전한 데이터일 때만 렌더"라, 첫 페인트를 두 달치가 다
 * 도착할 때까지 붙잡을 이유가 없다.
 *
 * 수정: 지난달 쿼리를 `thisMonthExpenses.isFetched` 뒤로 미룬다. 아래 두 종류의 테스트로 고정한다.
 *  1) 배선 계약(소스 검증) -- refresh-wiring-contract.test.ts / notification-flow.test.ts와 같은
 *     소스 grep 관례다(react-native 네이티브 바인딩이 없어 화면을 vitest에서 렌더할 수 없다).
 *  2) 라운드 37 G-1 주간 알림 3상태와의 상호작용 -- defer가 "판정 불가"를 길게 만들 뿐 월 페이스
 *     폴백을 오발화시키지 않는지, 실제 순수 모듈 + 알림 스토어로 콜드 스타트 프레임을 재생한다.
 */
const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

describe("UX-W(C8) 홈 첫 페인트 요청 구성 계약", () => {
  it("지난달 지출 쿼리는 이번 달 쿼리가 끝난 뒤에야 켜진다(첫 페인트 이후로 defer)", () => {
    expect(homeSource).toContain(
      "enabled: Boolean(authToken && childId && lastYearMonth && thisMonthExpenses.isFetched)"
    );
    // 선언 순서도 계약이다 -- 지난달 쿼리가 위에 있으면 `thisMonthExpenses`를 참조할 수 없다.
    expect(homeSource.indexOf("const thisMonthExpenses = useQuery({")).toBeLessThan(
      homeSource.indexOf("const lastMonthExpenses = useQuery({")
    );
  });

  it("이번 달 쿼리는 미루지 않는다 -- 주간 카드가 첫 페인트에 쓰는 데이터다", () => {
    const start = homeSource.indexOf("const thisMonthExpenses = useQuery({");
    const thisMonthQuery = homeSource.slice(start, homeSource.indexOf("});", start));
    expect(thisMonthQuery).toContain("enabled: Boolean(authToken && childId)");
    expect(thisMonthQuery).not.toContain("isFetched");
  });

  it("HOME-001 픽셀락: 세션이 없으면 어떤 쿼리도 켜지지 않는다", () => {
    // 세 쿼리(home/이번 달/지난달) 모두 authToken && childId를 통과해야 켜진다. 비세션
    // 미리보기(previewHome)는 종전처럼 네트워크를 전혀 건드리지 않는다.
    const enabledLines = homeSource.match(/^\s*enabled: .*$/gm) ?? [];
    const expenseOrHomeEnabled = enabledLines.filter((line) => line.includes("authToken"));
    expect(expenseOrHomeEnabled.length).toBeGreaterThanOrEqual(3);
    for (const line of expenseOrHomeEnabled) {
      expect(line).toContain("Boolean(authToken");
    }
  });

  it("캐시 키는 그대로 -- 기록 탭과 공유하므로 미룬 쿼리도 이미 채워진 캐시를 그대로 읽는다", () => {
    expect(homeSource).toContain('queryKey: ["expenses", childId, lastYearMonth]');
    expect(homeSource).toContain('queryKey: ["expenses", childId, thisYearMonth]');
  });

  it("주간 알림의 '확정 실패' 판정은 종전 그대로 두 쿼리의 isError만 본다", () => {
    // 비활성 쿼리의 isError는 false이므로, 미루는 동안 이 식은 참이 될 수 없다(아래 재생 테스트).
    expect(homeSource).toContain("expensesFailed: thisMonthExpenses.isError || lastMonthExpenses.isError");
  });
});

/**
 * react-query 쿼리 상태 중 이 배선이 실제로 읽는 세 필드만 흉내 낸다.
 * 핵심 사실 두 가지를 그대로 재현한다.
 *  - `enabled: false`인 쿼리는 fetch하지 않으므로 `isFetched`도 `isError`도 false다.
 *  - 실패한 fetch도 fetch이므로 `isFetched`는 true가 된다(에러가 지난달 쿼리를 영영 막지 않는다).
 */
type QueryState<T> = { data: T | undefined; isFetched: boolean; isError: boolean };

const idle = <T,>(): QueryState<T> => ({ data: undefined, isFetched: false, isError: false });
const settled = <T,>(data: T): QueryState<T> => ({ data, isFetched: true, isError: false });
const failed = <T,>(): QueryState<T> => ({ data: undefined, isFetched: true, isError: true });

type Row = { id: string; amountKrw: number; spentOn: string; expenseType: string };

const row = (id: string, spentOn: string, amountKrw: number): Row => ({
  id,
  amountKrw,
  spentOn,
  expenseType: "expense"
});

/** 홈 화면이 프레임마다 하는 계산 그대로(오프라인 재조정은 이 테스트의 관심사가 아니라 생략). */
function homeFrame(input: {
  todayIso: string;
  thisMonth: QueryState<{ expenses: Row[] }>;
  lastMonth: QueryState<{ expenses: Row[] }>;
}) {
  // 배선 계약: 지난달 쿼리는 이번 달이 fetch를 마치기 전에는 아예 켜지지 않는다.
  const lastMonthEnabled = input.thisMonth.isFetched;
  const lastMonth = lastMonthEnabled ? input.lastMonth : idle<{ expenses: Row[] }>();
  const weekly = evaluateWeeklySummary({
    todayIso: input.todayIso,
    thisMonthRecords: input.thisMonth.data?.expenses ?? null,
    lastMonthRecords: lastMonth.data?.expenses ?? null
  });
  return {
    weekly,
    resolution: resolveWeeklySpendForNotification({
      weekly: weekly ? { totalKrw: weekly.totalKrw, text: weekly.text } : null,
      expensesFailed: input.thisMonth.isError || lastMonth.isError
    })
  };
}

describe("UX-W(C8) x 라운드 37 G-1: defer는 '판정 불가'만 늘린다", () => {
  const kst = (year: number, month1: number, day: number) => Date.UTC(year, month1 - 1, day, 12) - SEOUL_UTC_OFFSET_MS;

  const homeSummary = (now: number) => ({
    child: { id: "child-1", nickname: "다온이", stageLabel: "24개월" },
    monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 300_000 },
    lastSeenStageLabel: "24개월",
    followupEntries: [],
    now
  });

  const weeklyEntries = () =>
    useNotificationStore.getState().entries.filter((entry) => entry.type === "weekly_summary");

  beforeEach(() => {
    useNotificationStore.getState().resetAll();
  });

  it("달 안에 들어오는 주: 지난달을 미뤄도 첫 페인트의 주간 카드·알림 문구가 그대로다", () => {
    // 2026-08-20(목): 이번 주 월요일은 8/17이라 이번 달 캐시만으로 구간이 다 덮인다.
    const todayIso = "2026-08-20";
    const thisMonth = settled({ expenses: [row("e1", "2026-08-18", 84_200)] });

    const deferred = homeFrame({ todayIso, thisMonth, lastMonth: idle() });
    expect(deferred.weekly?.text).toBe("이번 주 84,200원");
    // 지난달이 도착한 뒤에도 같은 문구다 -- 미루는 동안 부분 합계가 새어 나가지 않았다는 증거.
    const arrived = homeFrame({ todayIso, thisMonth, lastMonth: settled({ expenses: [row("e0", "2026-07-20", 50_000)] }) });
    expect(arrived.weekly?.text).toBe(deferred.weekly?.text);

    useNotificationStore.getState().ingest(
      evaluateHomeNotifications({ ...homeSummary(kst(2026, 8, 20)), weekly: deferred.resolution }),
      kst(2026, 8, 20)
    );
    expect(weeklyEntries().map((entry) => entry.title)).toEqual(["이번 주 84,200원"]);
  });

  it("달을 걸친 주: 미루는 동안 카드는 접히고 알림은 '판정 불가'다(월 페이스 폴백 없음)", () => {
    // 2026-09-01(화): 이번 주 월요일은 8/31이라 지난달 캐시가 있어야 이번 주 합계를 낼 수 있다.
    const todayIso = "2026-09-01";
    const thisMonth = settled({ expenses: [row("e2", "2026-09-01", 12_000)] });
    const lastMonth = settled({ expenses: [row("e1", "2026-08-31", 30_000)] });
    const now = kst(2026, 9, 1);

    // 1차 프레임: 이번 달 쿼리도 아직 진행 중 -- 지난달은 켜지지도 않았다(캐시가 있어도 무시).
    const firstPaint = homeFrame({ todayIso, thisMonth: idle(), lastMonth });
    expect(firstPaint.weekly).toBeNull();
    expect(firstPaint.resolution).toBeUndefined();

    // 2차 프레임(= C8이 새로 만드는 창): 이번 달은 도착했고 지난달 요청이 이제 막 떴다.
    const deferred = homeFrame({ todayIso, thisMonth, lastMonth: idle() });
    expect(deferred.weekly).toBeNull(); // 부분 합계에 "이번 주"라는 이름을 붙이지 않는다.
    // 확정 실패가 아니라 "아직 모름"이다 -- 이 값이 null이면 그 주의 dedupeKey가 월 페이스
    // 문구로 소진되어, 지난달이 도착해도 홈 카드와 알림이 다른 숫자를 말하게 된다.
    expect(deferred.resolution).toBeUndefined();
    useNotificationStore.getState().ingest(
      evaluateHomeNotifications({ ...homeSummary(now), weekly: deferred.resolution }),
      now
    );
    expect(weeklyEntries()).toEqual([]);
    expect(useNotificationStore.getState().seenDedupeKeys).not.toContain("weekly_summary:child-1:2026-W36");

    // 3차 프레임: 지난달이 도착하면 달을 걸친 주도 정확히 합산된다(12,000 + 30,000).
    const arrived = homeFrame({ todayIso, thisMonth, lastMonth });
    expect(arrived.weekly?.totalKrw).toBe(42_000);
    useNotificationStore.getState().ingest(
      evaluateHomeNotifications({ ...homeSummary(now), weekly: arrived.resolution }),
      now
    );
    expect(weeklyEntries().map((entry) => entry.title)).toEqual([arrived.weekly!.text]);
  });

  it("이번 달 쿼리가 확정 실패해도 지난달 쿼리는 잠기지 않고, 그때만 월 페이스로 폴백한다", () => {
    const todayIso = "2026-09-01";
    const now = kst(2026, 9, 1);
    // 실패도 fetch 완료다 -> 지난달 쿼리가 켜진다. 지난달까지 실패해야 "확정 실패"가 된다.
    const bothFailed = homeFrame({ todayIso, thisMonth: failed(), lastMonth: failed() });
    expect(bothFailed.resolution).toBeNull();
    useNotificationStore.getState().ingest(
      evaluateHomeNotifications({ ...homeSummary(now), weekly: bothFailed.resolution }),
      now
    );
    expect(weeklyEntries().map((entry) => entry.title)).toEqual(["이번 달 지금까지 300,000원 · 예산의 30%예요"]);

    // 반대로 이번 달만 실패하고 지난달이 아직 로딩 중이면 여전히 "확정 실패"다(종전과 동일).
    expect(homeFrame({ todayIso, thisMonth: failed(), lastMonth: idle() }).resolution).toBeNull();
  });
});
