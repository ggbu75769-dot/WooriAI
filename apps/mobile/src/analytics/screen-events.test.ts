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

/**
 * ANA-127: 구매 루프 퍼널의 빈 중간 단계를 메운 배선. 상세 열람은 화면 파일(vitest에서
 * import 불가)에, 구매 확인 응답은 오버레이 컴포넌트에 있어 여기서 소스 대조로 고정한다.
 * 순수 payload 빌더 자체는 events.test.ts가 단위 테스트한다.
 */
describe("ANA-127 purchase-loop funnel firing source contract", () => {
  it("fires item_detail_viewed once per launch per (child, item), only after the loaded detail renders", () => {
    const detailSource = source("app/items/[itemTemplateId].tsx");
    expect(detailSource).toContain('eventName: "item_detail_viewed"');
    expect(detailSource).toContain("buildItemDetailViewedPayload");
    expect(detailSource).toContain("itemName: detail.data.name");
    expect(detailSource).toContain("productLinkCount: detail.data.productLinks.length");
    // 세션당 중복 억제: app/index.tsx의 app_opened와 같은 모듈 레벨 관례.
    expect(detailSource).toContain("const trackedItemDetailViewsThisLaunch = new Set<string>();");
    expect(detailSource).toContain("const viewKey = `${childId}:${itemTemplateId}`;");
    expect(detailSource).toContain("if (trackedItemDetailViewsThisLaunch.has(viewKey)) return;");
    expect(detailSource).toContain("trackedItemDetailViewsThisLaunch.add(viewKey);");
    // 세션 게이트: 픽셀 락(app/pixel-lock.tsx)은 세션을 지우고 캡처하므로 프리뷰 렌더에서는
    // 발사되지 않는다. 로딩/에러로 튕긴 화면도 열람으로 세지 않는다(detail.data 필요).
    expect(detailSource).toContain("if (!hasSession || !detail.data) return;");
  });

  it("records the clicked link's platform so the follow-up answer can report the same dimension", () => {
    const detailSource = source("app/items/[itemTemplateId].tsx");
    expect(detailSource).toContain("platform: link.platform,");
  });

  it("fires purchase_followup_answered on all three prompt answers", () => {
    const promptSource = source("src/commerce/PurchaseFollowupPrompt.tsx");
    expect(promptSource).toContain('eventName: "purchase_followup_answered"');
    expect(promptSource).toContain("buildPurchaseFollowupAnsweredPayload({ answer, platform: activeFollowup.platform })");
    expect(promptSource).toContain('trackAnswer("purchased");');
    expect(promptSource).toContain('trackAnswer("not_purchased");');
    expect(promptSource).toContain('trackAnswer("dismissed");');
    // 세 갈래 모두 계측되어야 구매율이 부풀지 않는다 -- 답변당 정확히 한 번.
    for (const answer of ["purchased", "not_purchased", "dismissed"]) {
      expect(promptSource.split(`trackAnswer("${answer}")`).length - 1).toBe(1);
    }
    // 같은 동의 게이트(ANA-102)를 쓰는 공용 클라이언트를 통해서만 발사한다.
    expect(promptSource).toContain('import { trackAndFlushAnalyticsEvent } from "../analytics/client";');
  });
});
