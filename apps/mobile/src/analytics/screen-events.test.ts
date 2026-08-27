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
    // 리뷰 F6: 이 화면이 **저장하는** categoryId는 언제나 8타일(categoryCatalog)의 id라, 분석
    // 페이로드가 서버 카테고리 목록을 해석할 필요가 없다(그 배선은 도달 불가라 걷어냈다).
    // 페이로드에 들어가는 값이 화면이 고른 그 id 하나뿐인지를 여기서 고정한다.
    expect(expenseSource).toContain("categoryId: recordedCategoryId,");
    expect(expenseSource).not.toContain("serverCategories");
    // 라운드 38 H-6/H-11: ["categories"] 캐시를 읽는 배선이 다시 생겼지만, 그것은 프리필·맥락
    // 한 줄이 쓰는 **타일 매핑**이고 분석 페이로드와 무관하다(getQueryData 한 번, 새 요청 없음).
    expect(expenseSource.match(/getQueryData<\{ categories:/g) ?? []).toHaveLength(1);
    expect(expenseSource).toContain("buildTileCategoryIdResolver(");
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
    expect(detailSource).toContain("const viewKey = `${viewerKey}:${childId}:${itemTemplateId}`;");
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

/**
 * 라운드 39 UX-P: 리포트 공유 계측. 리포트 탭의 두 공유 카드(마일스톤 REP-103 · 월간 UX-H)는
 * 지금까지 아무 계측도 없어서, "공유까지 가는 사람이 있는가"를 알 방법이 없었다.
 */
describe("라운드 39 UX-P report_share_tapped 발사 계약", () => {
  const reportSource = source("app/(tabs)/reports.tsx");

  it("두 공유 핸들러가 각각 자기 reportType으로 정확히 한 번씩 발사한다", () => {
    expect(reportSource).toContain('eventName: "report_share_tapped"');
    expect(reportSource).toContain("buildReportShareTappedPayload({ reportType })");
    expect(reportSource).toContain('trackReportShareTapped("milestone");');
    expect(reportSource).toContain('trackReportShareTapped("monthly");');
    for (const reportType of ["milestone", "monthly"]) {
      expect(reportSource.split(`trackReportShareTapped("${reportType}")`).length - 1).toBe(1);
    }
  });

  it("공유할 내용이 없으면(가드에 걸리면) 발사하지 않는다 -- 누른 적 없는 공유를 세지 않는다", () => {
    for (const guard of ["if (!milestoneReport) return;", "if (!monthlyShareMessage) return;"]) {
      const guardIndex = reportSource.indexOf(guard);
      expect(guardIndex, guard).toBeGreaterThan(-1);
      const fireIndex = reportSource.indexOf("trackReportShareTapped(", guardIndex);
      expect(fireIndex).toBeGreaterThan(guardIndex);
    }
  });

  it("다른 발사 지점과 같은 동의 게이트·데모 세션 토큰 규약을 쓴다", () => {
    expect(reportSource).toContain('import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";');
    expect(reportSource).toContain("const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);");
    expect(reportSource).toContain("trackAndFlushAnalyticsEvent(authToken, {");
    expect(reportSource).not.toContain("trackAndFlushAnalyticsEvent(accessToken");
  });

  it("페이로드에는 아이 애칭·금액이 실리지 않는다 (enum 하나뿐)", () => {
    // 화면이 들고 있는 공유용 값들이 payload로 새지 않는지 -- 발사 블록만 잘라 확인한다.
    const fireIndex = reportSource.indexOf('eventName: "report_share_tapped"');
    const fireBlock = reportSource.slice(fireIndex, fireIndex + 400);
    for (const leak of ["shareChildName", "totalExpenseKrw", "monthlyShareMessage", "reportMonthLabel"]) {
      expect(fireBlock, leak).not.toContain(leak);
    }
  });
});

/**
 * 라운드 27 리뷰 L-2 / L-3: 이벤트 발사 지점의 **세션 규약**을 고정한다.
 *
 * 두 발견 모두 "누구의 세션에서 발사됐는가"를 잘못 다루던 문제다 -- L-2는 데모 세션의 답변이
 * 실계정 토큰으로 새어 나갈 수 있었고, L-3은 한 기기를 나눠 쓰는 가구에서 뒤에 로그인한 사람의
 * 열람이 통째로 사라졌다. 화면/오버레이 파일은 vitest에서 import할 수 없어 소스 대조로 고정한다.
 */
describe("라운드 27 L-2: 발사 토큰은 데모 세션 규약을 따른다", () => {
  it("구매 확인 응답도 다른 발사 지점과 같은 authToken 폴백을 쓴다 (accessToken 직접 전달 금지)", () => {
    const promptSource = source("src/commerce/PurchaseFollowupPrompt.tsx");
    expect(promptSource).toContain('import { LOCAL_SESSION_TOKEN } from "../api/client";');
    expect(promptSource).toContain("const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);");
    expect(promptSource).toContain("trackAndFlushAnalyticsEvent(authToken, {");
    // 데모 세션(accessToken=null)에서 큐에 쌓였다가 이후 실계정 로그인 시 실토큰으로 전송되는
    // 경로를 막는 것이 이 규약의 전부다 -- 예전 형태가 되살아나면 여기서 걸린다.
    expect(promptSource).not.toContain("trackAndFlushAnalyticsEvent(accessToken");
  });

  it("다른 발사 지점들의 폴백 표현과 글자 그대로 같다 (관례 단일화)", () => {
    const fallback = "const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);";
    for (const path of [
      "src/commerce/PurchaseFollowupPrompt.tsx",
      "app/items/[itemTemplateId].tsx",
      "app/(tabs)/records.tsx"
    ]) {
      expect(source(path), path).toContain(fallback);
    }
  });
});

describe("라운드 27 L-3: 상세 열람 dedupe는 세션 전환·동의 지연을 반영한다", () => {
  const detailSource = source("app/items/[itemTemplateId].tsx");

  it("사용자 전환: 중복 억제 키에 사용자 식별자가 들어간다 (데모 세션은 고정 문자열)", () => {
    expect(detailSource).toContain("const userId = useSessionStore((state) => state.userId);");
    expect(detailSource).toContain('const DEMO_SESSION_VIEWER_KEY = "demo-session";');
    expect(detailSource).toContain("const viewerKey = userId ?? (isTestSession ? DEMO_SESSION_VIEWER_KEY : UNKNOWN_VIEWER_KEY);");
    expect(detailSource).toContain("const viewKey = `${viewerKey}:${childId}:${itemTemplateId}`;");
    // 예전의 (child, item) 전용 키는 남아 있지 않아야 한다 -- A 로그아웃 → B 로그인 시
    // B의 열람이 A의 기록에 잡아먹혔다.
    expect(detailSource).not.toContain("const viewKey = `${childId}:${itemTemplateId}`;");
    // 키가 이펙트 의존성에도 들어가야 세션이 바뀐 직후 다시 판정된다.
    expect(detailSource).toContain("analyticsConsent, viewerKey, childId, itemTemplateId]");
  });

  it("동의 지연: 동의 게이트를 먼저 보고, 발사한 뒤에만 Set에 넣는다", () => {
    // trackAndFlushAnalyticsEvent는 void를 돌려주므로(동의 OFF면 조용히 버린다) 반환값으로
    // 발사 여부를 구분할 수 없다 -- 동의 상태를 직접 구독해서 판별한다.
    expect(source("src/analytics/client.ts")).toContain(
      "export function trackAndFlushAnalyticsEvent(token: string | null | undefined, input: TrackEventInput): void"
    );
    expect(detailSource).toContain('import { useAnalyticsConsentStore } from "../../src/analytics/flag";');
    expect(detailSource).toContain("const analyticsConsent = useAnalyticsConsentStore((state) => state.enabled);");
    expect(detailSource).toContain("if (!analyticsConsent) return;");

    const consentGate = detailSource.indexOf("if (!analyticsConsent) return;");
    const dedupeCheck = detailSource.indexOf("if (trackedItemDetailViewsThisLaunch.has(viewKey)) return;");
    const fire = detailSource.indexOf('eventName: "item_detail_viewed"');
    const add = detailSource.indexOf("trackedItemDetailViewsThisLaunch.add(viewKey);");
    expect(consentGate).toBeGreaterThan(-1);
    // 동의 OFF면 Set을 건드리기 전에 빠져나간다 -> 나중에 동의를 켜면 그때 발사된다.
    expect(dedupeCheck).toBeGreaterThan(consentGate);
    // add는 실제 발사 뒤다 (예전에는 발사 앞이라 동의 OFF 열람이 영구히 소진됐다).
    expect(add).toBeGreaterThan(fire);
  });
});
