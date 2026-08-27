import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();

describe("Batch 08 mobile family invite contract", () => {
  it("exposes household member and invite API client functions", async () => {
    const client = await import("./api/client");

    expect(client.listHouseholdMembers).toEqual(expect.any(Function));
    expect(client.createInvite).toEqual(expect.any(Function));
    expect(client.getInvite).toEqual(expect.any(Function));
    expect(client.acceptInvite).toEqual(expect.any(Function));
  });

  it("creates the locked family routes without changing the bottom tabs", () => {
    const routeExpectations = [
      ["app/(tabs)/_layout.tsx", "홈"],
      ["app/(tabs)/_layout.tsx", "기록"],
      ["app/(tabs)/_layout.tsx", "준비템"],
      ["app/(tabs)/_layout.tsx", "리포트"],
      ["app/(tabs)/_layout.tsx", "더보기"],
      ["app/family/index.tsx", "FAM-001"],
      ["app/family/index.tsx", "listHouseholdMembers"],
      ["app/family/index.tsx", "createInvite"],
      ["app/family/invite.tsx", "FAM-002"],
      ["app/family/invite.tsx", "createInvite"],
      ["app/family/accept/[token].tsx", "FAM-003"],
      ["app/family/accept/[token].tsx", "getInvite"],
      ["app/family/accept/[token].tsx", "acceptInvite"]
    ];

    for (const [relativePath, expectedText] of routeExpectations) {
      const filePath = join(mobileRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);
    }
  });
});

describe("FAM-121A 초대 수락 여정 배선 (source contract -- 화면은 vitest에서 렌더할 수 없어\n  기존 login-screen-contract.test.ts의 source-grep 관례를 따른다)", () => {
  const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

  it("비로그인 방문자에게 데드엔드 문구 대신 로그인 경로를 준다", () => {
    const acceptSource = source("app/family/accept/[token].tsx");
    // 예전: "로그인 후 가족에 참여할 수 있어요." 텍스트 + 비활성 버튼만 있고 갈 곳이 없었다.
    expect(acceptSource).toContain("로그인하고 참여하기");
    expect(acceptSource).toContain("const loginHref = loginHrefForInvite(token);");
    expect(acceptSource).toContain("router.push(loginHref)");
    expect(acceptSource).not.toContain("로그인 후 가족에 참여할 수 있어요.");
  });

  it("로그인 화면이 초대 파라미터를 읽어 수락 화면으로 되돌린다", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toContain(
      'import { INVITE_RESUME_PARAM, resumeHrefAfterLogin } from "../../src/children/household-join";'
    );
    expect(loginSource).toContain("const inviteResumeHref = resumeHrefAfterLogin(params[INVITE_RESUME_PARAM]);");
    // 카카오/개발 스텁 경로와 테스트 로그인 경로 둘 다 재개하되, 초대가 없으면 기존 목적지 그대로.
    expect(loginSource).toContain('router.replace(inviteResumeHref ?? "/onboarding/child-status");');
    expect(loginSource).toContain('router.replace(inviteResumeHref ?? "/(tabs)");');
  });

  it("수락 성공이 R19-C 관례대로 캐시 무효화 + 아이 재선택 + 안내를 수행한다", () => {
    const acceptSource = source("app/family/accept/[token].tsx");
    expect(acceptSource).toContain("HOUSEHOLD_JOIN_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))");
    expect(acceptSource).toContain("await listChildren(authToken!)");
    expect(acceptSource).toContain("planAfterHouseholdJoin({");
    expect(acceptSource).toContain("setSelectedChildId(plan.childId);");
    expect(acceptSource).toContain("announceForA11y(plan.notice);");
    expect(acceptSource).toContain("router.replace(plan.href)");
    // 예전에는 defaultHouseholdId만 바꾸고 무조건 /family로 갔다.
    expect(acceptSource).not.toContain('router.replace("/family")');
  });
});
