import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

// ADM-007: self-service password change. The API endpoint
// (POST /admin/auth/change-password) is MFA-exempt so a freshly created admin
// can rotate the one-time temp password from ADM-006 before enrolling MFA; the
// frontend exposes the form from the account area (AdminShell header) and from
// the MFA enrollment screen. See src/lib/admin-api.test.ts for behavioral
// coverage of the API client function.
describe("Admin change-password API client (ADM-007)", () => {
  it("exposes adminChangePassword against /admin/auth/change-password", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("adminChangePassword");
    expect(api).toContain("/admin/auth/change-password");
    expect(api).toContain("currentPassword");
    expect(api).toContain("newPassword");
  });
});

describe("Admin change-password form (ADM-007)", () => {
  it("lives in the AdminShell account area with current/new/confirm password fields", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain("ChangePasswordForm");
    expect(shell).toContain("adminChangePassword");
    expect(shell).toContain("비밀번호 변경");
    expect(shell).toContain("현재 비밀번호");
    expect(shell).toContain("새 비밀번호 확인");
    // Password inputs only — never plain text.
    expect(shell).toContain('type="password"');
  });

  it("mirrors the API's minimum-length policy client-side and confirms the new password before submitting", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain("newPassword.length < 10");
    expect(shell).toContain("newPassword !== confirmPassword");
  });

  it("is also reachable from the MFA enrollment screen, so a temp password can be rotated before enrollment", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain("임시 비밀번호를 먼저 변경할래요");
  });

  it("tells the admin that other sessions were revoked while this one stays signed in", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain("다른 곳의 로그인은 모두 해제되었어요");
  });

  it("never persists any password in browser storage", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).not.toContain("localStorage");
    expect(shell).not.toContain("sessionStorage");
  });
});
