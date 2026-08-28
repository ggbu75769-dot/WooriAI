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
 * GAP-064 #7 (라운드 64): 복구 코드 잔량이 **세 층 전부** 배선됐는가.
 *
 * 서버가 개수를 실어 보내도(admin-auth.service.ts) 클라이언트 세션 캐시가 그 칸을
 * 버리면 화면은 여전히 물어볼 자리가 없다. 라운드 63 #3이 세운 재등록 입구 옆에서
 * 잔량이 보여야, 마지막 한 장을 태우기 **전에** 재등록할 수 있다.
 */
describe("복구 코드 잔량 배선 (GAP-064 #7)", () => {
  it("세션 캐시가 잔량을 나른다 (me · 로그인 · MFA 로그인)", () => {
    const context = readSource("src/lib/admin-token-context.tsx");
    const shell = readSource("src/components/AdminShell.tsx");

    expect(context).toContain("mfaRecoveryCodesRemaining?: number");
    expect(context).toContain("mfaRecoveryCodesRemaining: me.mfaRecoveryCodesRemaining");
    expect(shell).toContain("mfaRecoveryCodesRemaining: result.mfaRecoveryCodesRemaining");
    // 로그인·MFA 검증 두 자리 모두(복구 코드로 들어오면 방금 태운 한 장이 빠진 값이다).
    expect(shell.match(/mfaRecoveryCodesRemaining: result\.mfaRecoveryCodesRemaining/g)).toHaveLength(2);
  });

  it("헤더가 순수 모듈의 문구를 그린다 — 화면이 문장을 짓지 않는다", () => {
    const shell = readSource("src/components/AdminShell.tsx");

    expect(shell).toContain('from "../lib/recovery-codes-view"');
    expect(shell).toContain("recoveryCodesNotice(session.mfaRecoveryCodesRemaining)");
    expect(shell).toContain("recoveryNotice.text");
    // 임계 이하에서만 붙는 안내가 같은 자리에서 함께 나간다.
    expect(shell).toContain("recoveryNotice.actionText");
    expect(shell).toContain("recoveryNotice.low");
    // 문구를 화면에서 다시 조립하지 않는다(모듈이 단일 소스 — 장수를 여기서 보간하지 않는다).
    expect(shell).not.toMatch(/남은 복구 코드 \$\{/);
  });

  it("라운드 63이 세운 그 자리 그대로다 — 새 화면·새 라우트 0건", () => {
    const shell = readSource("src/components/AdminShell.tsx");

    expect(shell).toContain("인증 앱 다시 등록");
    expect(shell).not.toContain("useRouter");
    expect(shell).not.toContain('href="/recovery');
  });

  it("등록을 마친 직후에도 잔량을 안다 — 방금 발급한 장수가 곧 잔량이다", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain("mfaRecoveryCodesRemaining: recoveryCodes?.length");
  });

  it("개수 말고는 아무것도 화면에 오지 않는다 (값·해시 금지)", () => {
    const view = readSource("src/lib/recovery-codes-view.ts");
    const api = readSource("src/lib/admin-api.ts");

    // 모듈은 숫자 하나만 받는다 — 코드 배열이 들어올 타입 자체가 없다.
    expect(view).toContain("recoveryCodesNotice(remaining: number | undefined)");
    expect(view).not.toContain("string[]");
    // 세션 응답 타입에도 코드 배열이 실리지 않는다(발급 화면의 setup/verify만 배열을 받는다).
    const meType = api.slice(api.indexOf("export function adminMe"), api.indexOf("export function adminLogout"));
    expect(meType).toContain("mfaRecoveryCodesRemaining?: number");
    expect(meType).not.toContain("recoveryCodes");
  });
});
