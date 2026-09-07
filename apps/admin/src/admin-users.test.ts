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

/**
 * 라운드 106 트랙 T5 — **한 번만 보이는 값의 복사가 조용히 실패하던 자리.**
 *
 * 임시 비밀번호 카드는 계정 생성 직후 **딱 한 번** 뜨고 다시 볼 수 없다. 종전에는
 * `navigator.clipboard`가 없거나(안전하지 않은 컨텍스트로 연 어드민) 권한이 거부되면
 * `catch`가 `setCopied(false)`만 하고 끝나서, [복사]를 눌러도 라벨은 "복사"인 채 아무 일도
 * 일어나지 않았다 — 운영자는 복사됐다고 믿고 클립보드의 **옛 값**을 새 관리자에게 보낼 수 있다.
 * 형제 화면(상품 링크의 공유 링크 복사)이 같은 실패에 이미 답을 갖고 있어 그 관례를 빌린다.
 */
describe("임시 비밀번호 복사 실패가 조용하지 않다 (라운드 106 트랙 T5)", () => {
  it("복사 실패에 안내 문구를 세운다 (형제 화면의 관례와 같은 말)", () => {
    const source = readSource("app/users/page.tsx");
    expect(source).toContain("TEMP_PASSWORD_COPY_FAILED_HINT");
    expect(source).toContain("클립보드에 복사하지 못했어요.");
    // 종전의 불리언 하나로는 실패와 "아직 안 눌렀음"이 같은 상태였다 — 셋으로 갈린다.
    expect(source).toContain('"idle" | "copied" | "failed"');
    expect(source).toContain('setCopyState("failed")');
    expect(source).toContain('copyState === "failed"');
    expect(source, "복사 성공 라벨이 사라졌어요").toContain('copyState === "copied" ? "복사됨" : "복사"');
  });

  it("실패해도 값 자체는 화면에 남는다 (직접 복사가 폴백이다)", () => {
    const source = readSource("app/users/page.tsx");
    expect(source).toContain("<code className={styles.calloutCode}>{notice.tempPassword}</code>");
    // 그 폴백을 문장이 가리킨다 — 안내 없이 값만 남겨 두지 않는다.
    expect(source).toContain("위 비밀번호를 직접 선택해 복사해 주세요.");
  });

  it("실패 문장이 소리로도 나간다 (카드가 이미 role=\"status\"다)", () => {
    const source = readSource("app/users/page.tsx");
    expect(source).toContain('<div className={styles.calloutWarning} role="status">');
  });
});
