import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/**
 * GAP-063 #3 (라운드 63): 인증 앱을 잃은 관리자의 복구 경로.
 *
 * 서버(POST /admin/auth/mfa/disable)도 클라이언트 래퍼(`adminMfaDisable`)도 이미 있었지만
 * 호출이 0건이라, 폰을 바꾼 관리자는 복구 코드를 한 장씩 태우다 다 쓰면 어드민에서 영구히
 * 잠겼다. 라운드 58 #3(`lockNow` 死코드)과 같은 모양의 결함이라 같은 모양으로 고정한다 —
 * "이 함수를 부르는 화면이 실제로 있는가"를 테스트가 지킨다.
 */
describe("Admin MFA re-enrollment entry point (GAP-063 #3)", () => {
  it("wires the existing adminMfaDisable wrapper — no new API function", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("adminMfaDisable");
    expect(api).toContain("/admin/auth/mfa/disable");
    // 래퍼는 정의 한 곳뿐이어야 한다(배선만 늘리고 함수를 새로 만들지 않는다).
    expect([...api.matchAll(/export function adminMfaDisable\b/g)]).toHaveLength(1);

    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain("adminMfaDisable");
    expect(shell).toContain("MfaDisableForm");
  });

  it("is reachable from the AdminShell account area, next to 비밀번호 변경", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    // 헤더 계정 영역의 버튼 + 같은 자리에서 열리는 폼(새 라우트·새 페이지 0건).
    expect(shell).toContain("인증 앱 다시 등록");
    expect(shell).toContain("비밀번호 변경");
    expect(shell).not.toContain("useRouter");
    expect(shell).not.toContain("/mfa-disable");
  });

  it("only ever opens one account panel at a time", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain('accountPanel === "password"');
    expect(shell).toContain('accountPanel === "mfa"');
  });

  it("says out loud that a recovery code works here (서버가 이미 받는 경로)", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    // verifyMfaCode(admin-auth.service.ts)는 TOTP 또는 복구 코드를 받는다. 화면이 그
    // 사실을 말하지 않으면 인증 앱을 잃은 사람에게 그 경로는 없는 것과 같다.
    expect(shell).toContain("복구 코드를 입력해도 돼요");
    expect(shell).toContain("복구 코드는 한 번만 쓸 수 있어요");
    expect(shell).toContain("인증 코드 또는 복구 코드");
  });

  it("tells the truth about what the server actually does (재등록 강제 · 복구 코드 폐기 · 다른 세션 해제)", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    // disableMfa: totpSecret/mfaEnabledAt/mfaRecoveryCodes 비우기 + 다른 세션 전량 폐기.
    expect(shell).toContain("등록을 마치기 전에는 다른 화면을 쓸 수 없고");
    expect(shell).toContain("새 복구 코드를 드려요");
    expect(shell).toContain("다른 곳의 로그인은 모두 해제되고, 이 세션은 유지돼요");
  });

  it("keeps SEC-101 intact: success only lowers mfaEnabled, the forced enrollment screen takes over", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain("setSession({ admin: session.admin, mfaEnabled: false })");
    // 강제 등록 게이트 자체는 그대로다 — 해제 뒤 등록을 건너뛸 수 있는 분기가 생기면 안 된다.
    expect(shell).toContain("if (!session.mfaEnabled) {");
    expect(shell).toContain("return <MfaSetupScreen />;");
  });

  it("surfaces the server's own failure message instead of a single blanket sentence", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    // 코드 오류(ADMIN_MFA_INVALID)·MFA 잠금·미등록(ADMIN_MFA_NOT_ENABLED)은 서로 다른
    // 사실이라 서버 문구를 그대로 보여주고, 예외적인 경우에만 일반 문구로 떨어진다.
    expect(shell).toContain("error instanceof AdminApiError ? error.message");
    expect(shell).toContain("2단계 인증을 해제하지 못했어요");
  });

  it("never persists the entered code in browser storage", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).not.toContain("localStorage");
    expect(shell).not.toContain("sessionStorage");
  });
});
