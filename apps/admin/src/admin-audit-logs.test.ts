import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

// ADM-113: audit log viewer. The API endpoint is admin-role-only (cookie
// session + CSRF + MFA, RequireAdminRoles("admin") in the API's
// audit-logs.controller.ts); the frontend hides the nav entry from
// editor/analyst sessions and shows an access notice instead of a broken page
// (same pattern as ADM-006 /users).
describe("Audit logs API client (ADM-113)", () => {
  it("exposes a typed list function against /admin/audit-logs with pagination and filters", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("listAuditLogs");
    expect(api).toContain("/admin/audit-logs");
    expect(api).toContain("AdminAuditLogEntry");
    expect(api).toContain("AdminAuditLogsPageInfo");
    // offset 페이지네이션 + 필터(액션/행위자/기간) 쿼리 파라미터.
    for (const param of ["limit", "offset", "action", "actorUserId", "from", "to"]) {
      expect(api).toContain(`params.set("${param}"`);
    }
    // 행위자 표시용 이메일과 마스킹된 before/after 스냅샷 필드.
    expect(api).toContain("actorEmail");
    expect(api).toContain("before: unknown");
    expect(api).toContain("after: unknown");
  });
});

describe("Audit logs page (ADM-113)", () => {
  it("lists audit entries with the 시각/관리자/액션/대상/상세 table columns", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("listAuditLogs");
    for (const column of ["<th>시각</th>", "<th>관리자</th>", "<th>액션</th>", "<th>대상</th>", "<th>상세</th>"]) {
      expect(source).toContain(column);
    }
    // 상세 칸은 before/after 스냅샷을 펼쳐 보여준다.
    expect(source).toContain("변경 내용 보기");
  });

  it("has pagination UI driven by the API's pageInfo (이전/다음 + page indicator)", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("pageInfo");
    expect(source).toContain("hasMore");
    expect(source).toContain("이전");
    expect(source).toContain("다음");
    expect(source).toContain("페이지");
    expect(source).toContain("offset");
  });

  it("offers action and date-range filters", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("액션 타입");
    expect(source).toContain("시작일");
    expect(source).toContain("종료일");
    expect(source).toContain("필터 적용");
  });

  it("gates the page to admin role and shows an access notice to other roles", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain('session?.admin.role === "admin"');
    expect(source).toContain("관리자(admin) 권한에서만 사용할 수 있어요");
  });

  it("clears the session on auth errors like the other admin pages", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("isAuthError");
    expect(source).toContain("clearSession");
  });

  it("is reachable from the admin nav for admin sessions only", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain("/audit-logs");
    expect(shell).toContain("감사 로그");
    expect(shell).toContain("item.roles.includes(session.admin.role)");
  });

  it("surfaces the typed fetch timeout as Korean guidance instead of an endless loading state", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("isTimeoutError");
    expect(source).toContain("요청 시간이 초과됐어요(10초)");
  });
});

// ADM-117: fetch timeout hardening on the shared admin API client -- mirrors
// the mobile precedent (apps/mobile/src/api/client.ts DEFAULT_FETCH_TIMEOUT_MS
// + AbortController + typed timeout error). Behavior is unit-tested in
// src/lib/admin-api.test.ts; this pins the structural contract.
describe("Admin API client fetch timeout (ADM-117)", () => {
  it("bounds every request with a 10s AbortController timeout and a typed error", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("DEFAULT_FETCH_TIMEOUT_MS = 10_000");
    expect(api).toContain("AbortController");
    expect(api).toContain("AdminApiTimeoutError");
    expect(api).toContain("fetchWithTimeout");
    // request()가 맨 fetch 대신 타임아웃 래퍼를 쓴다.
    expect(api).toContain("response = await fetchWithTimeout(");
    // 타임아웃 에러는 한국어 안내 메시지를 그대로 실어 나른다.
    expect(api).toContain("요청 시간이 초과됐어요(10초)");
    expect(api).toContain("isTimeoutError");
  });
});

// ADM-117: 감사로그 CSV 내보내기. 새 API 없이 기존 GET /admin/audit-logs를
// limit=100으로 페이지 순회해 최대 1,000행을 모아 클라이언트에서 CSV를
// 만들어 Blob 다운로드한다. 순수 로직(이스케이프/인젝션 중화/상한/파일명)은
// src/lib/audit-log-csv.test.ts에서 단위 테스트한다.
describe("Audit logs CSV export (ADM-117)", () => {
  it("has a CSV export module with escaping, formula-injection neutralization, and the 1,000-row cap", () => {
    const util = readSource("src/lib/audit-log-csv.ts");
    expect(util).toContain("AUDIT_LOG_EXPORT_MAX_ROWS = 1000");
    expect(util).toContain("AUDIT_LOG_EXPORT_PAGE_SIZE = 100");
    expect(util).toContain("escapeCsvCell");
    expect(util).toContain("buildAuditLogCsv");
    expect(util).toContain("collectAuditLogsForExport");
    // product-link-bulk-csv.util(API)과 동일한 수식 인젝션 방어 정책.
    expect(util).toContain('DANGEROUS_LEADING_CHARS = new Set(["=", "+", "-", "@", "\\t", "\\r"])');
    // 파일명 audit-logs-YYYYMMDD.csv.
    expect(util).toContain("audit-logs-${year}${month}${day}.csv");
  });

  it("offers a CSV export button that pages the existing list endpoint with the applied filters", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("CSV 내보내기");
    expect(source).toContain("collectAuditLogsForExport");
    expect(source).toContain("buildAuditLogCsv");
    expect(source).toContain("auditLogCsvFilename");
    // 현재 적용된 필터를 목록 조회와 공유한다 (내보내기 전용 API 없음).
    expect(source).toContain("filtersToQuery(appliedFilters)");
    expect(source).toContain("listAuditLogs({ ...query, ...page })");
  });

  it("downloads via a client-side Blob and disables the button with progress text while exporting", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("new Blob(");
    expect(source).toContain("URL.createObjectURL");
    expect(source).toContain("URL.revokeObjectURL");
    expect(source).toContain("disabled={exporting}");
    expect(source).toContain("내보내는 중...");
  });

  it("announces the 1,000-row truncation when the server has more rows", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("truncated");
    expect(source).toContain("상위 1,000건만 내보냈어요");
  });
});
