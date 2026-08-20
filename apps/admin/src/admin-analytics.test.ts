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
  totalEvents: 42,
  byName: [
    { name: "app_opened", count: 20 },
    { name: "onboarding_completed", count: 10 },
    { name: "expense_recorded", count: 6 },
    { name: "expense_synced", count: 0 },
    { name: "item_status_changed", count: 4 },
    { name: "affiliate_link_clicked", count: 2 }
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

  it("exposes all six registry event names with Korean labels (0건도 항상 표에 표시)", () => {
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
    // Funnel stages 온보딩 → 기록 → 체크 → 클릭, with per-stage conversion.
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
