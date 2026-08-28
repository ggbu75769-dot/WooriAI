import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();

describe("Batch 10 mobile settings contract", () => {
  it("exposes settings API client functions", async () => {
    const client = await import("./api/client");

    expect(client.getPrivacySettings).toEqual(expect.any(Function));
    expect(client.previewChildProfileDeletion).toEqual(expect.any(Function));
    expect(client.confirmChildProfileDeletion).toEqual(expect.any(Function));
    expect(client.previewHouseholdLeave).toEqual(expect.any(Function));
    expect(client.previewAccountDeletion).toEqual(expect.any(Function));
    expect(client.confirmAccountDeletion).toEqual(expect.any(Function));
  });

  it("creates settings and privacy routes without changing the fixed tabs", () => {
    const expectations = [
      ["app/(tabs)/_layout.tsx", "Tabs.Screen"],
      ["app/settings/index.tsx", "SET-001"],
      ["app/settings/index.tsx", "SET-002"],
      ["app/settings/index.tsx", "router.push(\"/settings/privacy\")"],
      ["app/settings/privacy.tsx", "SET-003"],
      ["app/settings/privacy.tsx", "SET-004"],
      ["app/settings/privacy.tsx", "previewChildProfileDeletion"],
      ["app/settings/privacy.tsx", "confirmChildProfileDeletion"],
      ["app/settings/privacy.tsx", "previewAccountDeletion"],
      ["app/settings/privacy.tsx", "confirmAccountDeletion"],
      ["app/settings/privacy.tsx", "requiresSecondStep"]
    ];

    for (const [relativePath, expectedText] of expectations) {
      const filePath = join(mobileRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);
    }
  });
});

/**
 * NAV-121 설정 진입 회복: 로그인 사용자에게 /settings로 가는 메뉴 행이 없어 아이 관리 · 알림 설정 ·
 * 통계 동의 철회 · 로그아웃이 모두 도달 불가였다. (react-native가 vitest에서 네이티브 바인딩 없이
 * 렌더되지 않으므로 import-flow/export-flow와 같은 source-grep 관례를 따른다.)
 */
describe("NAV-121 settings entry point contract", () => {
  const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

  it("puts a 설정 row into the signed-in more menu, not just the logged-out preview", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    const sessionRowsBlock = moreSource.slice(
      moreSource.indexOf("const sessionMenuRows"),
      moreSource.indexOf("const previewMenuRowActions")
    );

    expect(sessionRowsBlock).not.toBe("");
    // 라운드 41 UX-U(A): 세션 메뉴의 행 구성·이름·목적지는 src/settings/more-menu.ts로 옮겼다
    // (더보기 화면은 vitest에서 렌더할 수 없어 정보 구조 판정만 순수 모듈로 뺀 것). NAV-121이
    // 지키려는 계약("로그인 메뉴에 /settings 행이 있다")은 그대로이므로, 화면 쪽은 그 모듈을
    // 세션 메뉴의 소스로 쓰는지만 보고 라우트 자체는 모듈에서 확인한다.
    expect(sessionRowsBlock).toContain("buildMoreSessionMenuRows(");
    expect(moreSource).toContain("() => router.push(route)");
    const menuSource = source("src/settings/more-menu.ts");
    expect(menuSource).toContain('title: "설정", route: "/settings"');
    // 라운드 49 QA(P2-3): 세션 메뉴에 닿는 조건이 `hasSession`(토큰 + 아이)에서 **토큰**으로
    // 넓어졌다. NAV-121이 지키려는 것("로그인 메뉴에 /settings 행이 있다")은 오히려 더 강해진다
    // -- 아이가 아직 없는 사용자도 설정·로그아웃에 닿는다.
    expect(moreSource).toContain("const visibleMenuRows = authToken ? sessionMenuRows : previewMenuRowActions;");
  });

  it("keeps 아이 관리 · 알림 설정 · 통계 동의 · 로그아웃 reachable from the settings screen", () => {
    const settingsSource = source("app/settings/index.tsx");

    for (const expectedText of [
      'router.push("/settings/children")',
      'router.push("/settings/notifications")',
      'router.push("/settings/privacy")',
      "통계 수집 동의(선택)",
      "setAnalyticsConsent",
      "handleLogout",
      "clearSession()"
    ]) {
      expect(settingsSource).toContain(expectedText);
    }
  });

  it("collapses the duplicated /family rows into one and shows real summary values", () => {
    const settingsSource = source("app/settings/index.tsx");

    expect(settingsSource.match(/router\.push\("\/family"\)/g) ?? []).toHaveLength(1);
    // 무정보 요약("연결됨"/"선택됨") 대신 이미 로드된 가족 인원수 · 선택된 아이 태명을 보여준다.
    expect(settingsSource).not.toContain('"연결됨"');
    expect(settingsSource).not.toContain('"선택됨"');
    expect(settingsSource).toContain("`가족 ${members.data.members.length}명`");
    expect(settingsSource).toContain("`${selectedChild.nickname} · ${selectedChild.stageLabel}`");
    // 새 엔드포인트가 아니라 아이 관리 · 가족 관리 화면과 같은 캐시 키를 재사용한다.
    expect(settingsSource).toContain('queryKey: ["children"]');
    expect(settingsSource).toContain('queryKey: ["household-members", householdId]');
  });

  // 리뷰 F7: 로그아웃 후에도 selectedChildId가 남아 있으면 두 쿼리 모두 enabled:false라
  // 로딩도 실패도 아닌 상태가 되어 요약 줄이 "불러오는 중..."에 영구히 멈춘다.
  it("says the session is missing instead of loading forever when signed out with a stale selectedChildId", () => {
    const settingsSource = source("app/settings/index.tsx");

    expect(settingsSource).toContain('const summarySignedOutText = "로그인이 필요해요";');
    expect(settingsSource).toContain("const householdSummary = !authToken\n    ? summarySignedOutText");
    expect(settingsSource).toContain("const childSummary = !authToken\n    ? summarySignedOutText");
  });
});
