import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_EVENT_LABELS,
  ANALYTICS_EVENT_NAMES,
  AdminApiError,
  getAdminAnalyticsSummary,
  type AdminAnalyticsSummary
} from "./lib/admin-api";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

const SAMPLE_SUMMARY: AdminAnalyticsSummary = {
  days: 7,
  totalEvents: 46,
  byName: [
    { name: "app_opened", count: 20 },
    { name: "onboarding_completed", count: 10 },
    { name: "expense_recorded", count: 6 },
    { name: "expense_synced", count: 0 },
    { name: "item_status_changed", count: 4 },
    // ANA-127: 레지스트리에 추가된 두 이벤트도 byName에 함께 내려온다 (0건 포함).
    { name: "item_detail_viewed", count: 3 },
    { name: "affiliate_link_clicked", count: 2 },
    { name: "purchase_followup_answered", count: 1 }
  ],
  dailyTotals: [
    { date: "2026-08-14", count: 0 },
    { date: "2026-08-15", count: 10 },
    { date: "2026-08-16", count: 0 },
    { date: "2026-08-17", count: 12 },
    { date: "2026-08-18", count: 0 },
    { date: "2026-08-19", count: 8 },
    { date: "2026-08-20", count: 12 }
  ],
  funnel: {
    appOpened: 20,
    onboardingCompleted: 10,
    expenseRecorded: 6,
    itemStatusChanged: 4,
    affiliateLinkClicked: 2,
    expenseSynced: 0
  },
  // ANA-128: 이벤트 이름 총계(byName의 1건)와 별개로 answer별 분해가 함께 내려온다.
  purchaseFollowup: { purchased: 1, notPurchased: 0, dismissed: 0 },
  // 라운드 61 #5: 온보딩 단계 분해도 같은 방식으로 함께 내려온다 (레지스트리 순서, 0건 포함).
  onboardingSteps: [
    { step: "child_status", stepNumber: 1, count: 14 },
    { step: "child_profile", stepNumber: 2, count: 12 },
    { step: "prepared_items", stepNumber: 3, count: 11 },
    { step: "budget", stepNumber: 4, count: 10 }
  ],
  uniqueAnonUsers: 9
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// ADM-009: /admin/analytics/summary client — exercises the real request()
// wrapper (URL incl. days query, GET without CSRF header, error envelope
// mapping) against a stubbed fetch, mirroring the admin-api.test.ts pattern.
describe("admin analytics summary API client (ADM-009)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "admin_csrf=csrf-token-123; other=1" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET /admin/analytics/summary?days=7 returns the summary without a CSRF header", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_SUMMARY));

    const result = await getAdminAnalyticsSummary(7);

    expect(result).toEqual(SAMPLE_SUMMARY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("/api/v1/admin/analytics/summary?days=7");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    // CSRF echo is only for state-changing methods.
    expect(init.headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("GET /admin/analytics/summary?days=30 passes the 30-day window through", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ...SAMPLE_SUMMARY, days: 30 }));

    const result = await getAdminAnalyticsSummary(30);

    expect(result.days).toBe(30);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("/api/v1/admin/analytics/summary?days=30");
  });

  it("maps the API error envelope to AdminApiError (status + code + Korean message)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "days는 7 또는 30만 지원해요." } })
    );

    const error = await getAdminAnalyticsSummary(7).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AdminApiError);
    expect((error as AdminApiError).status).toBe(400);
    expect((error as AdminApiError).code).toBe("VALIDATION_ERROR");
    expect((error as AdminApiError).message).toBe("days는 7 또는 30만 지원해요.");
  });

  // admin-api.ts는 레지스트리 초기 6종의 미러다. ANA-127이 더한 두 이벤트와 라운드 39 UX-P가
  // 더한 report_share_tapped는 이 목록이 아니라 응답의 byName(레지스트리 생성)으로 들어와
  // 페이지의 ANA127_EVENT_LABELS가 라벨을 채운다.
  it("exposes the six mirrored registry event names with Korean labels (0건도 항상 표에 표시)", () => {
    expect(ANALYTICS_EVENT_NAMES).toEqual([
      "app_opened",
      "onboarding_completed",
      "expense_recorded",
      "expense_synced",
      "item_status_changed",
      "affiliate_link_clicked"
    ]);
    for (const name of ANALYTICS_EVENT_NAMES) {
      expect(ANALYTICS_EVENT_LABELS[name]).toBeTruthy();
    }
  });
});

// ADM-009: the /analytics page follows the existing page conventions
// (use client, loading/error/isAuthError handling, Korean labels) and renders
// the KPI funnel, fixed 6-event table, div bar chart, and 7/30-day toggle.
describe("Admin CMS analytics page (ADM-009)", () => {
  it("loads the analytics summary with the standard loading/error/retry states", () => {
    const source = readSource("app/analytics/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("getAdminAnalyticsSummary");
    expect(source).toContain("isAuthError");
    expect(source).toContain("clearSession");
    expect(source).toContain("불러오는 중...");
    expect(source).toContain("다시 시도");
    expect(source).toContain("분석 요약을 불러오지 못했어요.");
  });

  it("renders summary cards, the KPI funnel with conversion rates and the event-count approximation footnote", () => {
    const source = readSource("app/analytics/page.tsx");
    expect(source).toContain("총 이벤트");
    expect(source).toContain("순 사용자");
    // Funnel stages 온보딩 → 기록 → 체크 → 열람 → 클릭 → 구매 확인, with per-stage conversion.
    expect(source).toContain("KPI 퍼널");
    expect(source).toContain("온보딩 완료");
    expect(source).toContain("지출 기록");
    expect(source).toContain("준비템 체크");
    expect(source).toContain("제휴 링크 클릭");
    expect(source).toContain("전환율");
    expect(source).toContain("conversionRate");
    // The footnote makes explicit that rates are event-count approximations.
    expect(source).toContain("이벤트 수 기반");
    expect(source).toContain("근사치");
  });

  it("renders the fixed 6-event table (zero-filled), a div bar chart, and the 7/30-day toggle", () => {
    const source = readSource("app/analytics/page.tsx");
    expect(source).toContain("이벤트별 카운트");
    expect(source).toContain("ANALYTICS_EVENT_NAMES");
    expect(source).toContain("ANALYTICS_EVENT_LABELS");
    // Daily-trend bars are plain divs — no external chart library import.
    expect(source).toContain("일별 추이");
    expect(source).toContain("dailyTotals");
    expect(source).not.toMatch(/from ["'](recharts|chart\.js|d3|victory|nivo|echarts)/);
    // 7일/30일 window toggle re-fetches with the selected days value.
    expect(source).toContain("최근 {option}일");
    expect(source).toContain("setDays");
    expect(source).toMatch(/DAYS_OPTIONS[^=]*=\s*\[7,\s*30\]/);
  });

  /**
   * ANA-127: 4단 퍼널은 준비템 체크와 링크 클릭 사이가 통째로 비어 있어 전환율이 읽히지
   * 않았다. 상세 열람/구매 확인이 계측되면서 구매 루프가 6단으로 이어진다.
   * ANA-128: 마지막 단은 이벤트 전체가 아니라 "샀어요" 답변이므로 단계 식별자도
   * 이벤트 이름이 아닌 단계 이름(purchase_followup_purchased)이다.
   */
  it("renders the 6-stage purchase-loop funnel in order, ending at purchased-only", () => {
    const source = readSource("app/analytics/page.tsx");
    const block = source.split("const FUNNEL_STAGES")[1]?.split("];")[0] ?? "";
    // 라운드 61 #5가 앞에 붙인 온보딩 4단은 계약 미러에서 생성되므로 리터럴 key가 없다
    // (아래 "온보딩 4단 접두" 테스트가 그 4단을 따로 고정한다) — 여기서는 구매 루프 6단이
    // 그 뒤에 순서 그대로 남아 있는지만 본다.
    const stageKeys = [...block.matchAll(/key: "([a-z_]+)"/g)].map((match) => match[1]);
    expect(stageKeys).toEqual([
      "onboarding_completed",
      "expense_recorded",
      "item_status_changed",
      "item_detail_viewed",
      "affiliate_link_clicked",
      "purchase_followup_purchased"
    ]);
    expect(source).toContain("준비템 상세 열람");
    // 마지막 단계 수는 이벤트 이름 총계가 아니라 answer 분해의 purchased에서 온다.
    expect(block).toContain("summary.purchaseFollowup.purchased");
    expect(block).not.toContain('eventCount(summary, "purchase_followup_answered")');
  });

  /**
   * 이벤트 이름 단위 단계 수는 `funnel` 별칭이 아니라 `byName`에서 읽어야 한다 — 별칭 맵은
   * 레거시 6종으로 동결돼 새 이벤트 키가 없고(=항상 undefined), `byName`은 계약 레지스트리에서
   * 생성되어 0건 포함 전 이벤트를 담는다.
   */
  it("reads stage counts from byName (registry-driven) rather than the hardcoded funnel aliases", () => {
    const source = readSource("app/analytics/page.tsx");
    expect(source).toContain("function eventCount(summary: AdminAnalyticsSummary, eventName: string): number");
    expect(source).toContain("summary.byName.find((entry) => entry.name === eventName)?.count ?? 0");
    expect(source).toContain("const count = stage.count(summary);");
    expect(source).toContain("FUNNEL_STAGES[index - 1].count(summary)");
    // 존재하지 않는 별칭 키로 단계 수를 읽는 옛 경로는 남아 있지 않다.
    expect(source).not.toContain("summary.funnel[stage.key]");
    expect(source).not.toContain("keyof AdminAnalyticsFunnel");
  });

  /**
   * ANA-128 (허위 데이터 금지): 마지막 단계 라벨은 실제 집계 의미와 정확히 일치해야 한다.
   * 이제 "샀어요"만 세므로 라벨에 그렇게 적고, 각주도 3갈래 합계라던 옛 문구가 아니라
   * "샀어요로 답한 건수만"으로 갱신됐다.
   */
  it("labels the last stage as purchased-only and says exactly that in the footnote", () => {
    const source = readSource("app/analytics/page.tsx");
    expect(source).toContain('label: "구매 확인 응답 (샀어요)"');
    expect(source).toContain("&quot;샀어요&quot;로 답한 건수만");
    // 3갈래 합계를 마지막 단계로 쓰던 옛 각주는 남아 있지 않다.
    expect(source).not.toContain("샀어요·아직이요·괜찮아요 합계");
    expect(source).not.toContain("답변별 분해는 아직");
    // 근거 없이 "구매"라고만 단정하는 라벨도 쓰지 않는다.
    expect(source).not.toContain('label: "구매"');
    expect(source).not.toContain('label: "구매 완료"');
  });

  /**
   * 라운드 60 리뷰(P2-5) — 마지막 단은 **답**이지 구매가 아니다.
   *
   * 라운드 60 트랙 B가 "샀어요" 버튼에서 done 확정을 떼어 저장 자리로 옮겼다(모바일
   * PurchaseFollowupPrompt.tsx). 그 버튼은 기록 화면을 열 뿐이라 사용자가 화면을 닫으면 답만
   * 남고 지출은 없다 — 이 수를 "실구매"라고 부르면 앱이 이미 고친 부풀림을 어드민이 되살린다.
   */
  it("never calls the last funnel stage 실구매 — it counts an answer, not a record", () => {
    const source = readSource("app/analytics/page.tsx");
    // 옛 단정(전환율 = 실구매 비율)은 남아 있지 않다.
    expect(source).not.toContain("링크 클릭 → 실구매 비율이에요");
    expect(source).not.toContain("구매 확인 응답 (링크 클릭 → 실구매)");
    // 그 자리에 사실이 적힌다: 답이지 기록이 아니다.
    expect(source).toContain("<strong>답이지 기록이 아니에요</strong>");
    expect(source).toContain("구매 확인 응답 (링크 클릭 → 샀어요 응답)");
  });

  /**
   * 라운드 60 리뷰(P2-8) → 라운드 61 #5: 온보딩 단계는 계약(packages/contracts/src/analytics.ts의
   * `ONBOARDING_STEPS`)이 정한다. 어드민은 그 패키지를 의존성으로 들지 않으므로 목록을 손으로
   * 미러해 두고, **여기서 대조**한다. 라운드 60에는 대조할 것이 개수뿐이었지만 이제 그 목록이
   * 퍼널 앞 4단의 **순서와 라벨**까지 만들므로, 리터럴과 순서를 그대로 고정한다 — 레지스트리에
   * 단계가 늘거나 순서가 바뀌면 이 테스트가 깨지고, 고칠 곳은 페이지의 미러 배열 하나다.
   */
  it("keeps the ONBOARDING_STEPS mirror (literals + order) in sync with the contracts registry (대조 테스트)", () => {
    const source = readSource("app/analytics/page.tsx");
    const mirrorBlock = source.split("const ONBOARDING_STEPS:")[1]?.split("];")[0] ?? "";
    const mirrored = [...mirrorBlock.matchAll(/step: "([a-z_]+)"/g)].map((match) => match[1]);
    expect(mirrored.length).toBeGreaterThan(0);
    // 개수는 미러 배열에서 파생한다 — 손으로 적은 숫자가 목록과 어긋날 자리를 없앤다.
    expect(source).toContain("const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length;");

    const contractsSource = readSource(join("..", "..", "packages", "contracts", "src", "analytics.ts"));
    const steps = contractsSource.match(/export const ONBOARDING_STEPS = \[([^\]]*)\] as const;/)?.[1];
    expect(steps, "packages/contracts/src/analytics.ts should declare ONBOARDING_STEPS").toBeTruthy();
    const contractSteps = [...steps!.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
    expect(contractSteps.length).toBeGreaterThan(0);

    expect(
      mirrored,
      `어드민의 ONBOARDING_STEPS 미러(${mirrored.join(", ")})가 계약(${contractSteps.join(", ")})과 달라요`
    ).toEqual(contractSteps);
    // 라벨은 계약이 아니라 앱 화면 제목(steps.ts)의 말이므로 존재만 확인한다.
    expect([...mirrorBlock.matchAll(/label: "[^"]+"/g)]).toHaveLength(mirrored.length);
  });

  /**
   * ANA-128: 3갈래 분해 표 + 응답률/구매율 카드. 분해 합계가 이벤트 이름 총계보다 작을 수
   * 있다는 사실(answer 없는 레거시·손상 페이로드)을 숨기지 않고 "분류 불가"로 드러낸다.
   */
  it("renders the purchase-followup breakdown with 응답률/구매율 and an unclassified row", () => {
    const source = readSource("app/analytics/page.tsx");
    expect(source).toContain("구매 확인 응답 (링크 클릭 → 샀어요 응답)");
    expect(source).toContain("응답률 (클릭 대비 응답)");
    expect(source).toContain("구매율 (클릭 대비 샀어요)");
    // 3갈래가 모두 표에 있고, 각 행은 payload의 answer 리터럴을 그대로 밝힌다.
    const rows = source.split("const PURCHASE_FOLLOWUP_ROWS")[1]?.split("];")[0] ?? "";
    expect([...rows.matchAll(/answer: "([a-z_]+)"/g)].map((match) => match[1])).toEqual([
      "purchased",
      "not_purchased",
      "dismissed"
    ]);
    expect(rows).toContain('label: "샀어요"');
    expect(rows).toContain('label: "아직이요"');
    expect(rows).toContain('label: "괜찮아요"');
    // 분류 불가(answer 없음/미상)를 감추지 않는다.
    expect(source).toContain("분류 불가");
    expect(source).toContain("const unclassified = Math.max(0, answeredEvents - classified);");
    // 비율의 분모는 제휴 링크 클릭 수.
    expect(source).toContain('const clicks = eventCount(summary, "affiliate_link_clicked");');
    expect(source).toContain("conversionRate(clicks, followup.purchased)");
  });

  it("consumes the API's purchaseFollowup breakdown (admin-api exposes its type)", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("AdminPurchaseFollowupBreakdown");
    expect(api).toContain("purchaseFollowup: AdminPurchaseFollowupBreakdown;");
    expect(api).toContain("notPurchased: number;");

    const source = readSource("app/analytics/page.tsx");
    expect(source).toContain("type AdminPurchaseFollowupBreakdown");
    expect(source).toContain("summary.purchaseFollowup");
  });

  /**
   * 라운드 60 #9: 퍼널의 1단이 "온보딩 완료"라, 그 앞에서 일어난 이탈은 퍼널 안에서는 영영
   * 보이지 않았다. 단계 진입 계측을 퍼널 **바로 위** 카드로 붙이되, 퍼널의 단계로는 넣지
   * 않는다 -- 단계 진입은 사람당 최대 4건이라 퍼센트 전환율로 적으면 구조적으로 틀린다.
   */
  describe("라운드 60 #9 온보딩 단계 이탈 표기", () => {
    it("KPI 퍼널 바로 위에 온보딩 단계 이탈 카드를 둔다", () => {
      const source = readSource("app/analytics/page.tsx");
      expect(source).toContain("온보딩 단계 이탈 (퍼널 진입 전)");
      expect(source).toContain('eventCount(summary, "onboarding_step_viewed")');
      // 순서: 단계 이탈 카드가 KPI 퍼널 섹션보다 앞이다.
      expect(source.indexOf("온보딩 단계 이탈")).toBeLessThan(source.indexOf("<h2>KPI 퍼널</h2>"));
    });

    /**
     * 라운드 61 #5로 갱신: 퍼널에 들어간 것은 **단계별 분해**이지 이벤트 이름 합계가 아니다.
     * 합계(`onboarding_step_viewed`)를 단으로 쓰면 사람당 최대 4건이라 전환율이 구조적으로
     * 틀린다 — 그 금지는 그대로 두고, 분해(onboardingSteps)만 단이 된다.
     */
    it("퍼널에는 단계별 분해만 들어가고 이벤트 이름 합계는 여전히 단이 아니다", () => {
      const source = readSource("app/analytics/page.tsx");
      const block = source.split("const FUNNEL_STAGES")[1]?.split("];")[0] ?? "";
      expect(block).not.toContain("onboarding_step_viewed");
      expect(block).toContain("onboardingStepCount(summary, step.step)");
    });

    it("사람 수가 아니라는 사실을 숨기지 않고, 비율 대신 배수로만 적는다 (허위 데이터 금지)", () => {
      const source = readSource("app/analytics/page.tsx");
      expect(source).toContain("function stepsPerCompletion(stepViews: number, completions: number): string");
      // 완료 0건이면 계산 불가 — 0으로 나눈 값을 100%처럼 적지 않는다.
      expect(source).toContain("if (completions <= 0) return \"-\";");
      expect(source).toContain("사용자 수가 아니에요");
      // 진입 대비 완료를 퍼센트 전환율로 적는 경로는 없다.
      expect(source).not.toContain("conversionRate(stepViews");
    });

    it("어느 단계에서 멈췄는지를 어디서 보는지 화면이 가리킨다 (라운드 61 #5로 갱신)", () => {
      const source = readSource("app/analytics/page.tsx");
      expect(source).toContain("<strong>어느 단계에서</strong>");
      // 분해가 생겼으므로 "요약 API는 이벤트 이름 단위로만 집계해요"라던 옛 한계 문구는 없다.
      expect(source).not.toContain("요약 API는 이벤트 이름 단위로만 집계해요");
      expect(source).toContain("아래 KPI 퍼널의 앞 {ONBOARDING_STEP_COUNT}단");
    });
  });

  /**
   * 라운드 61 #5: 온보딩 단계 분해 읽기 경로. 퍼널의 1단이 "온보딩 완료"라 그 앞의 이탈이
   * 보이지 않던 사각지대를, 계약 순서 그대로의 4단 접두로 메운다.
   */
  describe("라운드 61 #5 온보딩 4단 퍼널 접두", () => {
    it("퍼널 앞에 계약 미러 순서대로 온보딩 4단을 접두한다", () => {
      const source = readSource("app/analytics/page.tsx");
      const block = source.split("const FUNNEL_STAGES")[1]?.split("];")[0] ?? "";
      // 접두는 미러 배열의 spread이므로 순서는 계약 순서와 같다(위 대조 테스트가 미러를 고정).
      expect(block).toContain("...ONBOARDING_STEPS.map((step) => ({");
      expect(block).toContain("key: `onboarding_step_${step.step}`");
      // 접두가 목록의 **맨 앞**이다 — 온보딩 완료(옛 1단)보다 먼저 나온다.
      expect(block.indexOf("...ONBOARDING_STEPS.map")).toBeLessThan(block.indexOf('key: "onboarding_completed"'));
    });

    it("단계 수는 API의 onboardingSteps에서 step 값으로 찾아 읽는다 (배열 위치를 믿지 않는다)", () => {
      const source = readSource("app/analytics/page.tsx");
      expect(source).toContain(
        "function onboardingStepCount(summary: AdminAnalyticsSummary, step: string): number"
      );
      expect(source).toContain("summary.onboardingSteps.find((entry) => entry.step === step)?.count ?? 0");
      expect(source).toContain("function classifiedOnboardingStepTotal(summary: AdminAnalyticsSummary): number");
    });

    it("분류 불가와 동의 기반 과소 계수를 숨기지 않는다 (허위 데이터 금지)", () => {
      const source = readSource("app/analytics/page.tsx");
      expect(source).toContain("const unclassifiedSteps = Math.max(0, stepViews - classifiedSteps);");
      expect(source).toContain("단계 값이 없거나 알 수 없는 이벤트");
      // P3(라운드 61 정찰): 동의 타이밍 때문에 단계 진입은 실제보다 적게 잡힌다 — 그 사실을 적는다.
      expect(source).toContain("<strong>통계 수집 동의를 켠 사용자만</strong>");
      expect(source).toContain("<strong>하한</strong>");
    });

    it("완료 건수가 퍼널의 몇 번째 단인지 접두 수에 맞춰 말한다", () => {
      const source = readSource("app/analytics/page.tsx");
      // 접두 전에는 "아래 퍼널의 1단과 같은 수예요"였다 — 4단이 앞에 붙었으므로 5단이다.
      expect(source).not.toContain("아래 퍼널의 1단과 같은 수예요");
      expect(source).toContain("아래 퍼널의 {ONBOARDING_STEP_COUNT + 1}단과 같은 수예요");
    });

    it("admin-api가 onboardingSteps 분해 타입을 노출한다", () => {
      const api = readSource("src/lib/admin-api.ts");
      expect(api).toContain("AdminOnboardingStepBreakdown");
      expect(api).toContain("onboardingSteps: AdminOnboardingStepBreakdown[];");
      expect(api).toContain("stepNumber: number;");
    });
  });

  it("labels the appended registry events in the per-event table (they arrive via byName, not the 6-name mirror)", () => {
    const source = readSource("app/analytics/page.tsx");
    expect(source).toContain('item_detail_viewed: "준비템 상세 열람"');
    expect(source).toContain('purchase_followup_answered: "구매 확인 응답"');
    // 라운드 39 UX-P가 레지스트리 맨 뒤에 붙인 이름 — 라벨이 없으면 표에 원문 이름이 노출된다.
    expect(source).toContain('report_share_tapped: "리포트 공유"');
    // 라운드 60 #9가 같은 규칙으로 붙인 이름.
    expect(source).toContain('onboarding_step_viewed: "온보딩 단계 진입"');
    expect(source).toContain("ANA127_EVENT_LABELS[name]");
    // 레지스트리 밖 이름을 덧붙이는 기존 경로는 그대로 살아 있어야 이 두 이름이 표에 나온다.
    expect(source).toContain("summary.byName.filter((entry) => !(ANALYTICS_EVENT_NAMES as string[]).includes(entry.name))");
  });

  it("adds the 분석 nav entry visible to every role, and admin-api exposes the summary types", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    // No `roles:` restriction on the entry — visible to admin/editor/analyst.
    expect(shell).toContain('{ href: "/analytics", label: "분석" }');

    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("getAdminAnalyticsSummary");
    expect(api).toContain("/admin/analytics/summary?days=");
    expect(api).toContain("AdminAnalyticsSummary");
    expect(api).toContain("uniqueAnonUsers");
    expect(api).toContain("AnalyticsSummaryDays = 7 | 30");
  });
});
