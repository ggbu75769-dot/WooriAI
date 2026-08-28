import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ONBOARDING_STEPS, PURCHASE_FOLLOWUP_ANSWERS, analyticsEventRegistry } from "@wooriai/contracts";
import { getSeoulToday } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";

/** ADM-009: the only two windows GET /admin/analytics/summary supports. */
export const ANALYTICS_SUMMARY_WINDOWS = [7, 30] as const;
export type AnalyticsSummaryWindow = (typeof ANALYTICS_SUMMARY_WINDOWS)[number];

export function isAnalyticsSummaryWindow(value: number): value is AnalyticsSummaryWindow {
  return (ANALYTICS_SUMMARY_WINDOWS as readonly number[]).includes(value);
}

/**
 * Convenience aliases for the KPI funnel (design doc docs/5차 §4.3): the same
 * per-event counts as `byName`, but keyed so the admin frontend never has to
 * find-by-name.
 *
 * R27(L-5): these six keys are the LEGACY set, frozen — not "one key per
 * registry event". ANA-127 appended `item_detail_viewed` and
 * `purchase_followup_answered` to the registry without alias keys, and that is
 * the intended end state: the admin funnel view reads `byName`, so new events
 * surface there and this shape stays stable for anything already reading it.
 */
export type AdminAnalyticsFunnel = {
  appOpened: number;
  onboardingCompleted: number;
  expenseRecorded: number;
  itemStatusChanged: number;
  affiliateLinkClicked: number;
  expenseSynced: number;
};

/**
 * ANA-128: `purchase_followup_answered`(COM-108 구매 확인 프롬프트) 응답을
 * payload의 `answer`별로 쪼갠 값. 이벤트 이름 단위 집계(byName)는 3갈래 합계라서
 * "링크 클릭 → 실구매" 전환율을 낼 수 없었다 — 그 합계를 구매 건수처럼 읽으면
 * 전환율이 부풀려지므로, 여기서 `purchased`만 따로 센다.
 *
 * 세 값의 합은 byName의 `purchase_followup_answered`와 같지 않을 수 있다:
 * `answer`가 없거나(레거시·손상 페이로드) 레지스트리 밖 문자열인 행은 어느
 * 갈래에도 더하지 않고 무시한다(없는 답변을 지어내지 않기 위해). 그 차이를
 * 보여줄 곳은 화면이며, 여기서는 세 리터럴만 정확히 센다.
 */
export type AdminPurchaseFollowupBreakdown = {
  /** "샀어요" (answer = "purchased"). */
  purchased: number;
  /** "아직이요" (answer = "not_purchased"). */
  notPurchased: number;
  /** "괜찮아요" (answer = "dismissed"). */
  dismissed: number;
};

/**
 * 라운드 61 #5: `onboarding_step_viewed`(라운드 60 #9 계측)를 payload의 `step`별로
 * 쪼갠 값. 라운드 60은 계측만 붙이고 읽기 경로가 없어서, 어드민은 네 단계의 **합계**
 * 하나만 볼 수 있었다 — "온보딩 중 어디서 그만두는가"라는 정확히 그 질문에는
 * 합계로 답할 수 없다(합계는 사람당 최대 4건이라 완료 대비 배수로밖에 못 읽는다).
 *
 * 한 단계당 한 항목이고, **계약 레지스트리(`ONBOARDING_STEPS`) 순서로 0건까지 채워서**
 * 내려간다(byName과 같은 규칙): 창 안에 어떤 단계가 있었는지에 따라 응답 형태가
 * 달라지지 않아야 화면이 표를 고정된 4행으로 그릴 수 있다.
 *
 * `stepNumber`는 **레지스트리 배열 위치(1부터)**에서 계산하지, 페이로드에 실려 온
 * `stepNumber`를 읽지 않는다 — 순서의 단일 소스는 계약이고, 클라이언트가 보낸 번호와
 * 단계 이름이 어긋난 행이 있어도 집계의 순서가 흔들리면 안 된다.
 *
 * 네 값의 합은 byName의 `onboarding_step_viewed`와 같지 않을 수 있다: `step`이
 * 없거나(레거시·손상 페이로드) 레지스트리 밖 문자열인 행은 어느 단계에도 더하지 않고
 * 무시한다(ANA-128의 answer 분해와 같은 판단 — 없는 단계를 지어내지 않는다). 그 차이를
 * 보여줄 곳은 화면이며, 여기서는 레지스트리 리터럴만 정확히 센다.
 */
export type AdminOnboardingStepBreakdown = {
  /** 계약 레지스트리의 단계 리터럴 (예: "child_status"). */
  step: string;
  /** 1부터 세는 단계 순서 = 레지스트리 배열 위치. */
  stepNumber: number;
  count: number;
};

/** ADM-009: shape returned by GET /admin/analytics/summary. */
export type AdminAnalyticsSummary = {
  days: AnalyticsSummaryWindow;
  totalEvents: number;
  /** Every registry event name is always present (count 0 included), registry
   * order first; any unregistered names found in the window are appended. */
  byName: { name: string; count: number }[];
  /** One entry per Seoul-calendar day in the window (ascending, zero-filled). */
  dailyTotals: { date: string; count: number }[];
  funnel: AdminAnalyticsFunnel;
  /** ANA-128: purchase_followup_answered를 payload.answer 3갈래로 분해한 값
   * (기존 필드는 그대로 두고 추가만 한 필드). */
  purchaseFollowup: AdminPurchaseFollowupBreakdown;
  /** 라운드 61 #5: onboarding_step_viewed를 payload.step 4단계로 분해한 값
   * (레지스트리 순서, 0건 포함 — 기존 필드는 그대로 두고 추가만 한 필드). */
  onboardingSteps: AdminOnboardingStepBreakdown[];
  /** count(distinct user_anon_id) in the window (null anon ids excluded). */
  uniqueAnonUsers: number;
};

/** ANA-128: 계측 이벤트 이름 — 분해 집계 대상. */
const PURCHASE_FOLLOWUP_EVENT_NAME = "purchase_followup_answered";

/** 라운드 61 #5: 단계 분해 집계 대상 이벤트 이름(라운드 60 #9가 심은 계측). */
const ONBOARDING_STEP_EVENT_NAME = "onboarding_step_viewed";

/**
 * ANA-128: payload.answer 리터럴 -> 응답 키. 리터럴은 계약 레지스트리
 * (`PURCHASE_FOLLOWUP_ANSWERS`)를 단일 소스로 쓰고, 여기서는 카멜케이스 키만
 * 붙인다 — 레지스트리에 답변이 늘면 아래 `satisfies`가 컴파일 타임에 걸린다.
 */
const PURCHASE_FOLLOWUP_KEY_BY_ANSWER = {
  purchased: "purchased",
  not_purchased: "notPurchased",
  dismissed: "dismissed"
} satisfies Record<
  (typeof PURCHASE_FOLLOWUP_ANSWERS)[number],
  keyof AdminPurchaseFollowupBreakdown
>;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * eventName -> funnel alias key.
 *
 * R27(L-5): the alias set is the six LEGACY events only — exactly the first six
 * entries of `analyticsEventRegistry` — and it does NOT (and need not) cover the
 * whole registry; the previous "Must cover every registry event name" claim has
 * been false since ANA-127 appended two events. New events are exposed through
 * `byName` alone, which is what the admin funnel view reads; do not add keys
 * here, because `funnel`'s response shape is frozen for existing readers.
 * Exported so `admin-analytics-funnel-alias.test.ts` can pin that correspondence
 * against the registry without a database.
 */
export const FUNNEL_KEY_BY_EVENT_NAME: Record<string, keyof AdminAnalyticsFunnel> = {
  app_opened: "appOpened",
  onboarding_completed: "onboardingCompleted",
  expense_recorded: "expenseRecorded",
  item_status_changed: "itemStatusChanged",
  affiliate_link_clicked: "affiliateLinkClicked",
  expense_synced: "expenseSynced"
};

/**
 * ADM-009: read-only aggregation over analytics_events for the admin KPI
 * funnel view. Deliberately five grouped/aggregate queries (Prisma groupBy +
 * four raw GROUP BY/COUNT DISTINCT) -- no rows are ever pulled into memory, so
 * the endpoint stays cheap as events accumulate. ANA-128 added the fourth: it
 * reads a single payload key (`answer`) but still only as a GROUP BY expression,
 * so the payload never crosses the DB boundary either. 라운드 61 #5's fifth
 * query is the same shape for `step` -- payload를 읽되 GROUP BY 식으로만 읽으므로
 * 행(그리고 페이로드)이 DB 경계를 넘지 않는 성질은 그대로다.
 *
 * Window semantics: the last `days` Seoul-calendar days INCLUDING today, i.e.
 * occurred_at in [Seoul midnight (days-1) days ago, next Seoul midnight).
 * `occurredAt` (event time) is used for every metric so the per-day bars, the
 * per-name counts, and totalEvents all agree with each other. Korea has no
 * DST, so fixed +09:00 day arithmetic is exact.
 */
@Injectable()
export class AnalyticsSummaryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSummary(days: AnalyticsSummaryWindow): Promise<AdminAnalyticsSummary> {
    const seoulToday = getSeoulToday();
    // Seoul midnight at the END of today (exclusive upper bound).
    const windowEnd = new Date(new Date(`${seoulToday}T00:00:00+09:00`).getTime() + DAY_MS);
    const windowStart = new Date(windowEnd.getTime() - days * DAY_MS);

    const [byNameRows, dailyRows, uniqueRows, followupRows, onboardingStepRows] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ["eventName"],
        where: { occurredAt: { gte: windowStart, lt: windowEnd } },
        _count: { _all: true }
      }),
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>(Prisma.sql`
        SELECT to_char(occurred_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date,
               COUNT(*) AS count
        FROM analytics_events
        WHERE occurred_at >= ${windowStart} AND occurred_at < ${windowEnd}
        GROUP BY 1
      `),
      this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
        SELECT COUNT(DISTINCT user_anon_id) AS count
        FROM analytics_events
        WHERE occurred_at >= ${windowStart} AND occurred_at < ${windowEnd}
          AND user_anon_id IS NOT NULL
      `),
      // ANA-128: 이 요약에서 payload를 읽는 유일한 쿼리. 행을 메모리로 끌어오지
      // 않고 `payload->>'answer'`로 GROUP BY 하므로 결과는 최대 서너 행이다
      // (Prisma groupBy는 JSON 경로로 그룹을 만들 수 없어 raw). 필터가
      // (event_name, occurred_at) 선두라 기존 idx_analytics_events_name_occurred가
      // 그대로 쓰인다 — payload용 별도 인덱스는 불필요.
      this.prisma.$queryRaw<{ answer: string | null; count: bigint }[]>(Prisma.sql`
        SELECT payload->>'answer' AS answer,
               COUNT(*) AS count
        FROM analytics_events
        WHERE event_name = ${PURCHASE_FOLLOWUP_EVENT_NAME}
          AND occurred_at >= ${windowStart} AND occurred_at < ${windowEnd}
        GROUP BY 1
      `),
      // 라운드 61 #5: ANA-128 쿼리의 복제 — 같은 성질을 그대로 유지한다. payload에서
      // 키 하나(`step`)만, 그것도 GROUP BY 식으로만 읽으므로 결과는 최대 대여섯 행이고
      // 행/페이로드가 메모리로 넘어오지 않는다. 필터가 (event_name, occurred_at)
      // 선두라 idx_analytics_events_name_occurred를 그대로 쓴다 — 새 인덱스 불필요.
      this.prisma.$queryRaw<{ step: string | null; count: bigint }[]>(Prisma.sql`
        SELECT payload->>'step' AS step,
               COUNT(*) AS count
        FROM analytics_events
        WHERE event_name = ${ONBOARDING_STEP_EVENT_NAME}
          AND occurred_at >= ${windowStart} AND occurred_at < ${windowEnd}
        GROUP BY 1
      `)
    ]);

    const countByName = new Map<string, number>(
      byNameRows.map((row) => [row.eventName, row._count._all])
    );

    // Registry names first (zero-filled, registry order) so the response shape
    // never depends on which events happen to exist in the window; any
    // unregistered names still in the table are appended (sorted) rather than
    // silently dropped, so totalEvents always equals the sum of byName.
    const registryNames = analyticsEventRegistry.map((entry) => entry.eventName);
    const registryNameSet = new Set(registryNames);
    const extraNames = [...countByName.keys()].filter((name) => !registryNameSet.has(name)).sort();
    const byName = [...registryNames, ...extraNames].map((name) => ({
      name,
      count: countByName.get(name) ?? 0
    }));

    const totalEvents = byName.reduce((sum, entry) => sum + entry.count, 0);

    const funnel = Object.fromEntries(
      Object.entries(FUNNEL_KEY_BY_EVENT_NAME).map(([eventName, key]) => [
        key,
        countByName.get(eventName) ?? 0
      ])
    ) as AdminAnalyticsFunnel;

    // ANA-128: 세 리터럴만 센다. answer가 NULL(레거시·손상 페이로드)이거나
    // 레지스트리에 없는 문자열인 행은 어느 갈래에도 더하지 않고 버린다 —
    // 임의로 한 갈래에 넣으면 그 자체가 허위 집계다. byName의 총계는 그 행들까지
    // 포함한 채로 그대로 유지되므로, 합계와 분해의 차이가 그대로 드러난다.
    const purchaseFollowup: AdminPurchaseFollowupBreakdown = {
      purchased: 0,
      notPurchased: 0,
      dismissed: 0
    };
    for (const row of followupRows) {
      // R29 리뷰: DB 텍스트를 그대로 객체 인덱싱하면 "__proto__"·"toString" 같은 값이
      // Object.prototype을 타고 undefined가 아닌 것을 돌려줘 미분류 가드를 우회한다 —
      // 자기 소유 키일 때만 리터럴로 인정한다.
      if (row.answer === null || !Object.hasOwn(PURCHASE_FOLLOWUP_KEY_BY_ANSWER, row.answer)) continue;
      const key = PURCHASE_FOLLOWUP_KEY_BY_ANSWER[row.answer as keyof typeof PURCHASE_FOLLOWUP_KEY_BY_ANSWER];
      purchaseFollowup[key] += Number(row.count);
    }

    // 라운드 61 #5: 레지스트리 4단계만, 레지스트리 순서로, 0건까지 채워서 만든다.
    // Map 조회라 프로토타입 오염 우회(ANA-128의 R29 리뷰 사유)가 성립하지 않고,
    // 레지스트리에 없는 step 문자열이나 step이 NULL인 행은 아예 매치되지 않으므로
    // 어느 단계에도 섞이지 않는다 — 그 행들은 byName 총계에만 남는다(화면이 그 차이를
    // "분류 불가"로 드러낸다).
    const countByStep = new Map<string, number>(
      onboardingStepRows
        .filter((row): row is { step: string; count: bigint } => row.step !== null)
        .map((row) => [row.step, Number(row.count)])
    );
    const onboardingSteps: AdminOnboardingStepBreakdown[] = ONBOARDING_STEPS.map((step, index) => ({
      step,
      // 순서의 단일 소스는 계약 배열이다 — 페이로드의 stepNumber는 읽지 않는다.
      stepNumber: index + 1,
      count: countByStep.get(step) ?? 0
    }));

    const countByDate = new Map<string, number>(
      dailyRows.map((row) => [row.date, Number(row.count)])
    );
    const dailyTotals = Array.from({ length: days }, (_, index) => {
      // windowStart + N days is Seoul midnight of that calendar day, so
      // getSeoulToday() of that instant is exactly that day's date string.
      const date = getSeoulToday(new Date(windowStart.getTime() + index * DAY_MS));
      return { date, count: countByDate.get(date) ?? 0 };
    });

    return {
      days,
      totalEvents,
      byName,
      dailyTotals,
      funnel,
      purchaseFollowup,
      onboardingSteps,
      uniqueAnonUsers: Number(uniqueRows[0]?.count ?? 0)
    };
  }
}
