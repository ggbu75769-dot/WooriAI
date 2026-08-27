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
    expect(sessionRowsBlock).toContain('title: "설정", onPress: () => router.push("/settings")');
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
});
