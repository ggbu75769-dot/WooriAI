import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();

function source(relativePath: string): string {
  const filePath = join(mobileRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/**
 * ANA-102/ANA-103 wired-up source contract (mirrors the settings-flow.test.ts /
 * onboarding-resume.test.ts source-scan convention): screen files can't be
 * imported under vitest (react-native/expo imports), so this pins that each
 * screen actually wires the consent toggle / event firing that events.test.ts
 * unit-tests in isolation.
 */
describe("ANA-102 consent UI source contract", () => {
  it("has the settings screen expose the opt-in analytics consent toggle wired to the flag store", () => {
    const settingsSource = source("app/settings/index.tsx");
    expect(settingsSource).toContain("통계 수집 동의(선택)");
    expect(settingsSource).toContain("useAnalyticsConsentStore");
    expect(settingsSource).toContain("state.setEnabled");
    expect(settingsSource).toContain("onValueChange={setAnalyticsConsent}");
    expect(settingsSource).toContain("value={analyticsConsent}");
    // Honest copy: anonymized-only, no PII, revocable anytime.
    expect(settingsSource).toContain("익명화된 사용 통계만 수집해요");
    expect(settingsSource).toContain("언제든지 끌 수 있어요");
  });

  it("keeps the flag store as the single consent source of truth (no other screen calls setEnabled)", () => {
    const flagSource = source("src/analytics/flag.ts");
    expect(flagSource).toContain('name: "wooriai-analytics-consent"');
    expect(flagSource).toContain("enabled: false");
  });
});

describe("ANA-103 event firing source contract", () => {
  it("fires app_opened once per cold start from the index route, only for a hydrated real session", () => {
    const indexSource = source("app/index.tsx");
    expect(indexSource).toContain('eventName: "app_opened"');
    expect(indexSource).toContain("let hasTrackedAppOpenedThisLaunch = false");
    expect(indexSource).toContain("if (!hydrated || !accessToken || hasTrackedAppOpenedThisLaunch)");
    expect(indexSource).toContain("hasTrackedAppOpenedThisLaunch = true");
    expect(indexSource).toContain("trackAndFlushAnalyticsEvent(accessToken");
  });

  it("keeps a timeout fallback on the onboarding-progress server check so a hung request cannot blank the screen", () => {
    const indexSource = source("app/index.tsx");
    expect(indexSource).toContain('setTimeout(() => setProgressFetch("done"), 3000)');
  });

  it("fires expense_recorded through the PII-safe payload builder on successful quick-expense create", () => {
    const expenseSource = source("app/expenses/new.tsx");
    expect(expenseSource).toContain('eventName: "expense_recorded"');
    expect(expenseSource).toContain("buildExpenseRecordedPayload");
    // Raw values are bucketed/mapped by the builder; the follow-up flow is distinguished and
    // connectivity at record time backs the `offline` flag.
    expect(expenseSource).toContain('linkedItemTemplateId ? "followup" : "manual"');
    expect(expenseSource).toContain("isCurrentlyOnline().then((online)");
    expect(expenseSource).toContain("offline: !online");
    // 리뷰 F6: 이 화면의 categoryId는 8타일(categoryCatalog)뿐이라 서버 카테고리 목록 해석은
    // 도달 불가였다 -- 배선을 걷어냈고, 되살아나면 여기서 걸린다.
    expect(expenseSource).not.toContain("serverCategories");
    expect(expenseSource).not.toContain('getQueryData<{ categories:');
  });

  it("fires item_status_changed from the items tab status buttons after server confirmation", () => {
    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).toContain('eventName: "item_status_changed"');
    expect(itemsSource).toContain("buildItemStatusChangedPayload");
    expect(itemsSource).toContain("itemName: variables.itemName, status: variables.status");
  });

  it("fires item_status_changed from the 찜하기 toggle and 이미 준비로 표시, and affiliate_link_clicked from purchase-link presses", () => {
    const detailSource = source("app/items/[itemTemplateId].tsx");
    expect(detailSource).toContain('eventName: "item_status_changed"');
    expect(detailSource).toContain("buildItemStatusChangedPayload");
    expect(detailSource).toContain("trackItemStatusChanged(status)");
    expect(detailSource).toContain('trackItemStatusChanged("prepared")');
    expect(detailSource).toContain('eventName: "affiliate_link_clicked"');
    expect(detailSource).toContain('buildAffiliateLinkClickedPayload({ platform: link.platform, screenId: "item_detail" })');
  });
});
