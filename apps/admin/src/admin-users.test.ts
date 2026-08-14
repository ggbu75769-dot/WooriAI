import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

// ADM-006: admin account management page. The API endpoints are admin-role-only
// (cookie session + CSRF + MFA, same as every other admin route); the frontend
// hides the nav entry from editor/analyst sessions and shows an access notice
// instead of a broken page. See src/lib/admin-api.test.ts for behavioral
// coverage of the API client functions themselves.
describe("Admin accounts API client (ADM-006)", () => {
  it("exposes typed list/create/update functions against /admin/users", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("listAdminUsers");
    expect(api).toContain("createAdminUser");
    expect(api).toContain("updateAdminUser");
    expect(api).toContain("/admin/users");
    expect(api).toContain("AdminUserAccount");
    expect(api).toContain("tempPassword");
    expect(api).toContain("isSelfUpdateForbiddenError");
    expect(api).toContain("ADMIN_SELF_UPDATE_FORBIDDEN");
  });
});

describe("Admin accounts page (ADM-006)", () => {
  it("lists accounts and exposes create + role-change + active-toggle flows", () => {
    const source = readSource("app/users/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("listAdminUsers");
    expect(source).toContain("createAdminUser");
    expect(source).toContain("updateAdminUser");
    expect(source).toContain("lastLoginAt");
    expect(source).toContain("createdAt");
  });

  it("gates the page to admin role and shows an access notice to other roles", () => {
    const source = readSource("app/users/page.tsx");
    expect(source).toContain('session?.admin.role === "admin"');
    expect(source).toContain("관리자(admin) 권한에서만 사용할 수 있어요");
  });

  it("shows the one-time temp password with the never-shown-again warning and never persists it", () => {
    const source = readSource("app/users/page.tsx");
    expect(source).toContain("tempPassword");
    expect(source).toContain("이 비밀번호는 다시 표시되지 않습니다");
    expect(source).toContain("clipboard");
    // One-time display lives in React state only — no browser storage.
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
  });

  it("confirms before deactivation and surfaces the self-update 403 as a friendly message", () => {
    const source = readSource("app/users/page.tsx");
    expect(source).toContain("window.confirm");
    expect(source).toContain("isSelfUpdateForbiddenError");
    expect(source).toContain("본인 계정의 권한을 낮추거나 비활성화할 수 없어요");
  });

  it("is reachable from the admin nav for admin sessions only", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain("/users");
    expect(shell).toContain("관리자 계정");
    expect(shell).toContain('roles: ["admin"]');
    expect(shell).toContain("item.roles.includes(session.admin.role)");
  });
});
