import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminApiError,
  CLICK_SUMMARY_DAYS_OPTIONS,
  PRODUCT_PLATFORM_LABELS,
  getAffiliateClickSummary,
  type ClickSummary
} from "./lib/admin-api";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

const SAMPLE_SUMMARY: ClickSummary = {
  totalClicks: 128,
  byPlatform: [
    { platform: "coupang", count: 90 },
    { platform: "naver", count: 30 },
    { platform: "custom", count: 8 }
  ],
  days: 7,
  windowTotalClicks: 41,
  topLinks: [
    {
      productLinkId: "link-1",
      productLinkTitle: "쿠팡 아기 욕조",
      itemTemplateId: "item-1",
      itemTemplateName: "아기 욕조",
      platform: "coupang",
      count: 25
    },
    {
      productLinkId: "link-2",
      productLinkTitle: "네이버 분유 포트",
      itemTemplateId: "item-2",
      itemTemplateName: "분유 포트",
      platform: "naver",
      count: 12
    },
    {
      productLinkId: "link-3",
      productLinkTitle: null,
      itemTemplateId: null,
      itemTemplateName: null,
      platform: null,
      count: 4
    }
  ],
  dailyTotals: [
    { date: "2026-08-21", count: 0 },
    { date: "2026-08-22", count: 5 },
    { date: "2026-08-23", count: 0 },
    { date: "2026-08-24", count: 11 },
    { date: "2026-08-25", count: 7 },
    { date: "2026-08-26", count: 8 },
    { date: "2026-08-27", count: 10 }
  ]
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// ADM-123: /admin/affiliate-clicks/summary 클라이언트 — 실제 request() 래퍼를
// stub fetch로 태워 URL(days 쿼리 포함)·GET에 CSRF 헤더 미부착·에러 봉투 매핑을
// 검증한다(admin-analytics.test.ts와 동일한 패턴).
describe("admin click summary API client (ADM-123)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "admin_csrf=csrf-token-123; other=1" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("기본 7일 창으로 요청하고, GET이라 CSRF 헤더를 붙이지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_SUMMARY));

    const result = await getAffiliateClickSummary();

    expect(result).toEqual(SAMPLE_SUMMARY);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("/api/v1/admin/affiliate-clicks/summary?days=7");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("30일 창을 그대로 전달한다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ...SAMPLE_SUMMARY, days: 30 }));

    const result = await getAffiliateClickSummary(30);

    expect(result.days).toBe(30);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("/api/v1/admin/affiliate-clicks/summary?days=30");
  });

  it("API 에러 봉투를 AdminApiError로 매핑한다", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "days는 7 또는 30만 지원해요." } })
    );

    const error = await getAffiliateClickSummary(7).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AdminApiError);
    expect((error as AdminApiError).status).toBe(400);
    expect((error as AdminApiError).code).toBe("VALIDATION_ERROR");
  });

  it("기간 선택지는 7/30일뿐이고 플랫폼 라벨은 한국어다", () => {
    expect(CLICK_SUMMARY_DAYS_OPTIONS).toEqual([7, 30]);
    expect(PRODUCT_PLATFORM_LABELS.coupang).toBe("쿠팡");
    expect(PRODUCT_PLATFORM_LABELS.naver).toBe("네이버");
    expect(PRODUCT_PLATFORM_LABELS.custom).toBe("기타");
  });

  it("전체 기간 합계와 기간 합계는 별개 필드로 온다(하위호환 확장)", () => {
    expect(SAMPLE_SUMMARY.byPlatform.reduce((sum, entry) => sum + entry.count, 0)).toBe(SAMPLE_SUMMARY.totalClicks);
    expect(SAMPLE_SUMMARY.dailyTotals.reduce((sum, entry) => sum + entry.count, 0)).toBe(
      SAMPLE_SUMMARY.windowTotalClicks
    );
    expect(SAMPLE_SUMMARY.windowTotalClicks).toBeLessThanOrEqual(SAMPLE_SUMMARY.totalClicks);
  });
});

// ADM-123: /clicks 페이지가 기존 페이지 관례(use client, 로딩/에러/재시도,
// admin-api·module.css)를 지키면서 상위 링크 표·일별 추이·기간 선택을 렌더한다.
describe("Admin CMS clicks page (ADM-123)", () => {
  it("표준 로딩/에러/재시도 상태로 클릭 통계를 불러온다", () => {
    const source = readSource("app/clicks/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("getAffiliateClickSummary");
    expect(source).toContain("isAuthError");
    expect(source).toContain("clearSession");
    expect(source).toContain("불러오는 중...");
    expect(source).toContain("다시 시도");
    expect(source).toContain("클릭 통계를 불러오지 못했어요.");
    // 기존 admin 페이지 관례: admin-api 클라이언트 + 공용 module.css.
    expect(source).toContain('from "../../src/lib/admin-api"');
    expect(source).toContain('from "../../src/components/admin-page.module.css"');
  });

  it("상위 상품 링크 표에 준비템명·링크 제목·리테일러·클릭 수를 보여준다", () => {
    const source = readSource("app/clicks/page.tsx");
    expect(source).toContain("상위 상품 링크");
    expect(source).toContain("topLinks");
    expect(source).toContain("준비템");
    expect(source).toContain("링크 제목");
    expect(source).toContain("리테일러");
    expect(source).toContain("itemTemplateName");
    expect(source).toContain("productLinkTitle");
    expect(source).toContain("platformLabel");
    // 링크/준비템이 삭제된 경우에도 행이 사라지지 않는다.
    expect(source).toContain("(삭제된 링크)");
    expect(source).toContain("(삭제된 준비템)");
    // DNC-009: 이 순위가 추천 점수와 무관함을 화면에 명시한다.
    expect(source).toContain("추천 점수에 반영되지 않아요");
  });

  it("일별 추이를 외부 차트 라이브러리 없이 div 막대 + 표로 그린다", () => {
    const source = readSource("app/clicks/page.tsx");
    expect(source).toContain("일별 추이");
    expect(source).toContain("dailyTotals");
    expect(source).toContain('role="img"');
    expect(source).not.toMatch(/from ["'](recharts|chart\.js|d3|victory|nivo|echarts)/);
    // 막대 옆에 날짜/클릭 수 표도 함께 둔다.
    expect(source).toContain("<th>날짜</th>");
  });

  it("7일/30일 기간 선택이 재조회를 일으킨다", () => {
    const source = readSource("app/clicks/page.tsx");
    expect(source).toContain("CLICK_SUMMARY_DAYS_OPTIONS");
    expect(source).toContain("최근 {option}일");
    expect(source).toContain("setDays");
    expect(source).toContain("aria-pressed");
    // days가 useCallback 의존성에 들어가야 토글이 곧 재조회다.
    expect(source).toMatch(/\[session, clearSession, days\]/);
  });

  /**
   * FIX/F6: 기간을 바꾸는 동안 이전 창의 집계가 그대로 남아 있어서, 버튼은 "최근 30일"이
   * 눌린 상태(aria-pressed)인데 표 제목·데이터는 최근 7일을 보여줬다. 실패했을 때도
   * 마찬가지로 옛 데이터가 에러 배너 위에 남았다.
   */
  it("기간 전환·실패 중에 이전 창 집계를 화면에 남기지 않는다", () => {
    const source = readSource("app/clicks/page.tsx");
    // 새 요청을 시작하면 이전 집계를 비우고 명시적 로딩 상태로 들어간다.
    expect(source).toContain("setLoading(true)");
    expect(source).toContain("setSummary(null)");
    expect(source).toContain("{loading ? <p className={styles.emptyState}>불러오는 중...</p> : null}");
    // 실패 경로에서도 집계를 비운다(에러 배너 + 다시 시도만 남는다).
    expect(source).toMatch(/catch \(error\) \{[\s\S]*setSummary\(null\)/);
    // 늦게 도착한 이전 요청이 최신 창을 덮어쓰지 않는다.
    expect(source).toContain("requestSeq");
    expect(source).toContain("if (requestSeq.current !== seq) return;");
  });

  it("admin-api가 분해 타입/쿼리를 노출한다", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("/admin/affiliate-clicks/summary?days=");
    expect(api).toContain("ClickSummaryDays = 7 | 30");
    expect(api).toContain("windowTotalClicks");
    expect(api).toContain("topLinks");
    expect(api).toContain("dailyTotals");
  });
});
