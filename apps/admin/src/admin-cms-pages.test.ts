import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

// SEC-102: the admin app no longer holds a Bearer token in sessionStorage/memory.
// Auth is an HttpOnly `admin_session` cookie set by the API; the frontend only
// ever reads the non-HttpOnly `admin_csrf` cookie (to echo it back as a header)
// and never persists a secret in browser storage.
describe("Admin CMS cookie session gate", () => {
  it("gates the app behind a cookie session (no client-held Bearer/localStorage token) and forces MFA enrollment", () => {
    const gate = readSource("src/components/AdminShell.tsx");
    expect(gate).toContain("use client");
    expect(gate).toContain("로그인");
    expect(gate).toContain("MfaSetupScreen");

    const sessionContext = readSource("src/lib/admin-token-context.tsx");
    expect(sessionContext).not.toContain("sessionStorage");
    expect(sessionContext).not.toContain("localStorage");

    const api = readSource("src/lib/admin-api.ts");
    expect(api).not.toContain("Authorization");
    expect(api).not.toContain("x-admin-token");
    expect(api).toContain("credentials: \"include\"");
    expect(api).toContain("X-CSRF-Token");
  });
});

describe("Admin CMS two-step login + forced MFA enrollment (SEC-101)", () => {
  it("logs in with password then TOTP/recovery code before establishing a session", () => {
    const gate = readSource("src/components/AdminShell.tsx");
    expect(gate).toContain("adminLogin");
    expect(gate).toContain("mfaRequired");
    expect(gate).toContain("adminVerifyMfaLogin");
  });

  it("renders a QR/manual-key MFA setup screen and shows recovery codes exactly once", () => {
    const gate = readSource("src/components/AdminShell.tsx");
    expect(gate).toContain("adminMfaSetupStart");
    expect(gate).toContain("adminMfaSetupVerify");
    expect(gate).toContain("recoveryCodes");
    expect(gate).toContain("qrcode");
  });

  it("wires session-expiry to a login redirect via clearSession on 401", () => {
    const gate = readSource("src/components/AdminShell.tsx");
    expect(gate).toContain("clearSession");
    const api = readSource("src/lib/admin-api.ts");
    // 403 (RBAC/CSRF/MFA-required) must not be treated as "log the admin out" --
    // only a real 401 (invalid/expired session) should trigger isAuthError.
    expect(api).toContain("error.status === 401");
  });
});

describe("Admin web security headers + same-origin API proxy", () => {
  it("proxies /api/v1 same-origin and sets baseline static security headers", () => {
    const config = readSource("next.config.js");
    expect(config).toContain("X-Content-Type-Options");
    expect(config).toContain("X-Frame-Options");
    expect(config).toContain("rewrites");
    expect(config).toContain("/api/v1/:path*");
  });

  // CSP is set per-request in middleware.ts (not next.config.js) because
  // Next.js App Router's inline RSC hydration scripts require a per-request
  // nonce to run at all under a script-src that isn't 'unsafe-inline'.
  it("sets a nonce-based CSP with frame-ancestors 'none' in middleware", () => {
    const middleware = readSource("middleware.ts");
    expect(middleware).toContain("Content-Security-Policy");
    expect(middleware).toContain("frame-ancestors 'none'");
    expect(middleware).toContain("nonce");
    expect(middleware).toContain("x-nonce");
  });
});

describe("Admin CMS item templates page", () => {
  it("exposes create and update flows against the admin item-templates API", () => {
    const source = readSource("app/items/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("createItemTemplate");
    expect(source).toContain("updateItemTemplate");
    expect(source).toContain("necessityLevel");
  });
});

describe("Admin CMS product links page", () => {
  it("exposes create and update flows against the admin product-links API with URL validation", () => {
    const source = readSource("app/links/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("createProductLink");
    expect(source).toContain("updateProductLink");
    expect(source).toContain("isHttpUrl");
  });

  // COM-105: link_health 워커 잡이 기록한 헬스체크 결과를 링크 목록에 배지로 노출한다.
  it("renders a per-link health badge (정상/깨짐/불안정/미확인) with a relative checked-at time", () => {
    const source = readSource("app/links/page.tsx");
    expect(source).toContain("link.healthStatus");
    expect(source).toContain("link.healthCheckedAt");
    expect(source).toContain("healthBadgeClass");
    expect(source).toContain("formatRelativeTime");
    expect(source).toContain("링크 상태");
    // 미확인(아직 검사 전) 라벨은 admin-api의 상수로 렌더링한다.
    expect(source).toContain("LINK_HEALTH_UNKNOWN_LABEL");

    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("LINK_HEALTH_LABELS");
    expect(api).toContain("정상");
    expect(api).toContain("깨짐");
    expect(api).toContain("불안정");
    expect(api).toContain("미확인");
    expect(api).toContain("healthStatus: LinkHealthStatus | null");
    expect(api).toContain("healthCheckedAt: string | null");
  });
});

describe("Admin CMS disclosures page", () => {
  it("exposes read and update flows against the admin disclosures API", () => {
    const source = readSource("app/disclosures/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("listDisclosures");
    expect(source).toContain("updateDisclosure");
  });

  /**
   * GAP-065 #9: 이 화면은 아무 key나 upsert할 수 있고 서버는 키를 검증하지 않는다.
   * 그래서 목록의 각 행과 새 키 입력칸이 "앱이 이 키를 읽는지"를 배지로 말한다 —
   * 저장을 막는 검증이 아니라(나중에 쓸 키를 미리 막게 된다) 사실 표시다.
   */
  it("marks which disclosure keys the app actually reads (DNC-010 오타 키 사각)", () => {
    const source = readSource("app/disclosures/page.tsx");
    expect(source).toContain("disclosureKeyBadge");
    expect(source).toContain("styles.badge");
    // 표시일 뿐 저장을 막지 않는다 — 알 수 없는 키를 거르는 분기가 없어야 한다.
    expect(source).not.toContain("APP_READ_DISCLOSURE_KEYS");

    const keys = readSource("src/lib/disclosure-keys.ts");
    expect(keys).toContain("affiliate_purchase");
    expect(keys).toContain("sponsored_product");
  });
});

// ADM-008: the dashboard home renders a live ops-summary strip on top of the
// static section links, backed by GET /admin/dashboard/summary.
describe("Admin CMS dashboard home summary strip", () => {
  it("loads the dashboard summary with loading/error states and Korean stat labels", () => {
    const source = readSource("app/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("getAdminDashboardSummary");
    // Loading / error / retry states follow the clicks-page conventions.
    expect(source).toContain("불러오는 중...");
    expect(source).toContain("다시 시도");
    expect(source).toContain("대시보드 요약을 불러오지 못했어요.");
    // Every counter is rendered as a stat card with a Korean label.
    expect(source).toContain("운영 현황 요약");
    expect(source).toContain("활성 사용자");
    expect(source).toContain("가구");
    expect(source).toContain("등록된 아이");
    expect(source).toContain("누적 지출 기록");
    expect(source).toContain("최근 7일 제휴 클릭");
    expect(source).toContain("최근 7일 분석 이벤트");
    expect(source).toContain("검수 대기 콘텐츠");
    expect(source).toContain("깨진 상품 링크");

    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("getAdminDashboardSummary");
    expect(api).toContain("/admin/dashboard/summary");
    expect(api).toContain("AdminDashboardSummary");
  });
});

describe("Admin CMS click summary page", () => {
  it("reads the affiliate click summary endpoint", () => {
    const source = readSource("app/clicks/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("getAffiliateClickSummary");
  });
});

// UX-X(R43) C5: 대시보드 숫자에서 그 숫자를 만든 목록으로 바로 넘어가고, 워커가
// 실제로 돌고 있는지 한 줄로 보여준다.
describe("Admin dashboard: drill-down cards + background worker line (UX-X C5)", () => {
  it("links the 검수 대기 콘텐츠 / 깨진 상품 링크 counters to the pre-filtered lists", () => {
    const source = readSource("app/page.tsx");
    expect(source).toContain('href: "/reviews?status=in_review"');
    // 라운드 44 리뷰 N-5: 깨진 링크 카드의 숫자는 활성 링크 안에서만 센 값이라(서버),
    // 목록도 같은 모집단으로 열어야 카드의 수와 줄 수가 어긋나지 않는다.
    expect(source).toContain('href: "/links?health=broken&active=1"');

    // 대상 화면이 그 파라미터를 실제로 읽는다.
    expect(readSource("app/links/page.tsx")).toContain("linkFiltersFromSearchParams");
    expect(readSource("app/reviews/page.tsx")).toContain("revisionStatusFilterFromSearchParams");
  });

  it("shows worker liveness from the public /health/worker snapshot", () => {
    const source = readSource("app/page.tsx");
    expect(source).toContain("백그라운드 작업");
    expect(source).toContain("getWorkerHealth");
    expect(source).toContain("workerHealthState");
    expect(source).toContain("linkHealthCheckLine");

    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("/health/worker");
  });

  // 허위 안심 제거: 검사가 꺼져 있으면 "깨진 상품 링크 0"은 이상 없음이 아니다.
  it("labels a broken-link count of 0 as 확인 안 됨 while the link check is not running", () => {
    expect(readSource("app/page.tsx")).toContain("brokenLinkCountCaption");
    expect(readSource("src/lib/worker-health-view.ts")).toContain("0건 = 확인 안 됨");
  });
});

// UX-X(R43) C6: 검토 목록에서 상세를 열지 않고도 대상과 예약 시각을 알 수 있다.
describe("Admin content review list: 대상/예약 columns (UX-X C6)", () => {
  it("renders the target name and the scheduled time from the list payload (no API change)", () => {
    const source = readSource("app/reviews/page.tsx");
    expect(source).toContain("<th>대상</th>");
    expect(source).toContain("<th>예약</th>");
    expect(source).toContain("revisionTargetLabel(revision)");
    expect(source).toContain("formatDate(revision.scheduledFor)");
  });
});

// UX-X(R43) C7: 준비템 목록에서 이름으로 찾고, 링크가 없어 구매로 이어지지 않는
// 준비템을 골라낸다.
describe("Admin item templates list: search + link count (UX-X C7)", () => {
  it("filters by name and by '상품 링크 없음' without extra requests", () => {
    const source = readSource("app/items/page.tsx");
    expect(source).toContain("filterItemTemplates");
    expect(source).toContain("상품 링크 없음만 보기");
    expect(source).toContain("필터 초기화");
    expect(source).toContain("<th>링크 수</th>");
    expect(source).toContain("productLinkCount(item)");
    // 목록은 한 번만 불러온다 — 필터는 받아온 배열만 좁힌다.
    expect(source).toContain("listItemTemplates");
  });
});

// 라운드 49 C-02(어드민 조각): 준비템 생성/수정 폼의 분류(categoryId) 입력.
// 이 칸이 없던 동안 시드 밖에서 만든 준비템은 categoryId가 영영 null이었고, 앱의
// "준비템 → 지출 기록" 분류 프리필이 그 품목에서만 조용히 동작하지 않았다.
describe("Admin item templates: category (categoryId) input", () => {
  it("offers a 분류 select in both the create and edit forms, with an explicit empty option", () => {
    const source = readSource("app/items/page.tsx");
    expect(source).toContain("categoryId");
    expect(source).toContain("-category`}>분류</label>");
    // 빈 선택(분류 없음)은 계속 허용된다.
    expect(source).toContain('<option value="">분류 없음</option>');
    // 선택지 계산은 순수 모듈이 담당한다(단위 테스트: src/lib/item-category-options.test.ts).
    expect(source).toContain("itemCategoryOptions");
    // 생성 폼과 수정 폼이 같은 필드 컴포넌트를 공유하므로 두 곳 모두에 붙는다.
    expect(source).toContain("categoryOptions={createCategoryOptions}");
    expect(source).toContain("categoryOptions={editCategoryOptions}");
  });

  it("loads the category list from the existing admin categories endpoint, tolerating a failure", () => {
    const source = readSource("app/items/page.tsx");
    expect(source).toContain("listAdminCategories");
    // 분류 목록 실패가 준비템 목록 전체를 막지 않는다.
    // 라운드 73 트랙 D: 종전 불리언(categoryLoadFailed)이 실패 사실만 남기고 이유를 버렸다 —
    // 이제 같은 자리가 조회 실패 한 벌(src/lib/load-error-copy.ts)이 만든 문장을 받는다.
    expect(source).toContain("categoryLoadError");
    expect(source).toContain('loadErrorMessage(error, "분류 목록을 불러오지 못해 지금은 고를 수 없어요.")');
  });

  it("sends categoryId only when one is picked (the server DTO takes a UUID, and an omitted value keeps the stored one)", () => {
    const source = readSource("app/items/page.tsx");
    expect(source).toContain("if (form.categoryId) input.categoryId = form.categoryId;");
    // 수정 폼 안내는 서버 동작(생략 = 유지)과 일치해야 한다 — "지워요"라고 쓰면 허위 안내.
    expect(source).toContain("비워두면 지금 분류를 그대로 둬요");

    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("categoryId?: string;");
  });
});
