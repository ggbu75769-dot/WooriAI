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
});
