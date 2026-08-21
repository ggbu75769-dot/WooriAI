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
 * COM-108 wired-up source contract (mirrors the src/analytics/screen-events.test.ts /
 * items-commerce-flow.test.ts source-scan convention): the screen/layout/prompt files can't be
 * imported under vitest (react-native/expo imports), so this pins that the purchase-followup
 * loop unit-tested in purchase-followup.store.test.ts is actually wired into the app.
 */
describe("COM-108 purchase follow-up source contract", () => {
  it("records a pending purchase check from the item-detail product-link press, before the server click call", () => {
    const detailSource = source("app/items/[itemTemplateId].tsx");
    expect(detailSource).toContain('import { usePurchaseFollowupStore } from "../../src/commerce/purchase-followup.store";');
    expect(detailSource).toContain("usePurchaseFollowupStore.getState().recordLinkClick({");
    expect(detailSource).toContain("itemName: visibleDetail.name");
    expect(detailSource).toContain("priceBandText: visibleDetail.priceBandText ?? undefined");
    expect(detailSource).toContain("clickedAt: Date.now()");

    // Recorded inside the session-gated branch of handleProductLinkPress (canCallLinkApi), and
    // before the server-side click record fires, so it never runs in preview mode.
    const recordIndex = detailSource.indexOf("usePurchaseFollowupStore.getState().recordLinkClick({");
    const gateIndex = detailSource.indexOf("if (canCallLinkApi) {");
    const mutateIndex = detailSource.indexOf("clickLink.mutate(link.id);");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(recordIndex).toBeGreaterThan(gateIndex);
    expect(mutateIndex).toBeGreaterThan(recordIndex);

    // COM-106/COM-101 pins stay intact: exact react-native import line and CTA ordering.
    expect(detailSource).toContain('import { Image, Linking, Pressable, Share, Text, View } from "react-native";');
    expect(detailSource.indexOf("바로 구매하기")).toBeGreaterThan(detailSource.indexOf("{visibleDetail.skipReasonText}"));
  });

  /**
   * R19-B (DNC-002 핵심 루프의 마지막 고리): 구매 후 기록과 준비템 상태가 하나의 흐름이다.
   * 서버가 연결 지출을 받으면 준비템을 준비 완료로 올리므로(apps/api store-shared.ts
   * markLinkedItemPrepared), 클라이언트는 (a) 기록 성공 후 준비템 캐시를 무효화하고
   * (b) 아이템 상세에서 "지출 기록"을 배타적 대안이 아닌 기본 경로로 안내해야 한다.
   */
  it("wires the record-expense path to the preparation-item status refresh and presents it as the primary follow-up", () => {
    const expenseSource = source("app/expenses/new.tsx");
    // (a) 연결 지출일 때만 준비템 목록/상세 캐시를 무효화한다 -- 일반 기록은 상태를 바꾸지 않는다.
    expect(expenseSource).toContain("if (linkedItemTemplateId) {");
    expect(expenseSource).toContain('await queryClient.invalidateQueries({ queryKey: ["items"] });');
    expect(expenseSource).toContain('await queryClient.invalidateQueries({ queryKey: ["item-detail"] });');
    const guardIndex = expenseSource.indexOf("if (linkedItemTemplateId) {");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(expenseSource.indexOf('queryKey: ["items"] }')).toBeGreaterThan(guardIndex);

    // (b) 아이템 상세: 지출 기록이 기본(PrimaryButton) 경로이고, 준비 완료가 함께 처리된다는
    // 안내가 붙는다. "지출 없이 표시"는 보조 수단으로만 남는다.
    const detailSource = source("app/items/[itemTemplateId].tsx");
    expect(detailSource).toContain('label="지출 기록하고 준비 완료"');
    expect(detailSource).toContain("지출을 기록하면 이 준비템도 자동으로 준비 완료로 표시돼요.");
    expect(detailSource).toContain('label="지출 없이 준비 완료로 표시"');
    // 예전의 배타적 2버튼 라벨은 남아 있지 않다.
    expect(detailSource).not.toContain('label="지출도 기록하기"');
    expect(detailSource).not.toContain('label="이미 준비로 표시"');

    // COM-108 "샀어요"도 같은 라우트를 타므로 동일한 효과를 얻는다 (별도 상태 API 호출 없음).
    const promptSource = source("src/commerce/PurchaseFollowupPrompt.tsx");
    expect(promptSource).toContain('router.push({ pathname: "/expenses/new", params: { itemName, itemTemplateId } });');
    expect(promptSource).not.toContain("updateItemStatus");

    // 데모/테스트 세션의 로컬 백엔드도 같은 고리를 미러링한다 (보존 규칙 포함).
    const localBackendSource = source("src/api/local-backend.ts");
    expect(localBackendSource).toContain("applyLinkedItemPrepared(state.itemStatuses, record.linkedItemTemplateId, record.id)");
    expect(localBackendSource).toContain('existing.status === "gifted" || existing.status === "not_needed"');
  });

  it("mounts the follow-up lifecycle once at the app root, overlaying the navigator", () => {
    const layoutSource = source("app/_layout.tsx");
    expect(layoutSource).toContain('import { PurchaseFollowupLifecycle } from "../src/commerce/PurchaseFollowupPrompt";');
    expect(layoutSource).toContain("<PurchaseFollowupLifecycle />");
    // Rendered after <Stack> so the bottom card sits on top of whatever screen is focused.
    expect(layoutSource.indexOf("<PurchaseFollowupLifecycle />")).toBeGreaterThan(layoutSource.indexOf("<Stack"));
  });

  it("keeps the prompt non-blocking, session-gated, and wired to foreground/cold-start checks", () => {
    const promptSource = source("src/commerce/PurchaseFollowupPrompt.tsx");
    // Session gate: inert when logged out / preview; demo (test) session counts as a session.
    expect(promptSource).toContain("const hasSession = Boolean(accessToken) || isTestSession;");
    expect(promptSource).toContain("if (!hasSession) {");
    expect(promptSource).toContain("if (!hasSession || !activeFollowup) return null;");
    // Foreground-return + cold-start (post-rehydration) triggers.
    expect(promptSource).toContain('AppState.addEventListener("change"');
    expect(promptSource).toContain('if (status === "active") check();');
    expect(promptSource).toContain("usePurchaseFollowupStore.persist.hasHydrated()");
    expect(promptSource).toContain("usePurchaseFollowupStore.persist.onFinishHydration");
    // Once per app session per click.
    expect(promptSource).toContain("const promptedThisSession = new Set<string>();");
    // Never blocks navigation: overlay lets touches pass through outside the card.
    expect(promptSource).toContain('pointerEvents="box-none"');
    expect(promptSource).toContain('position: "absolute"');
  });

  it("asks 구매하셨나요? with the three follow-up actions, reusing the expenses/new followup params", () => {
    const promptSource = source("src/commerce/PurchaseFollowupPrompt.tsx");
    expect(promptSource).toContain("구매하셨나요?");
    expect(promptSource).toContain('label="샀어요"');
    expect(promptSource).toContain('label="아직이요"');
    expect(promptSource).toContain('label="괜찮아요"');
    // 샀어요 routes into the existing quick-expense sheet with the same params the item-detail
    // "지출도 기록하기" action uses -- app/expenses/new.tsx (not edited by COM-108) turns
    // itemTemplateId into linkedItemTemplateId, making the analytics source "followup".
    expect(promptSource).toContain('router.push({ pathname: "/expenses/new", params: { itemName, itemTemplateId } });');
    const expenseSource = source("app/expenses/new.tsx");
    expect(expenseSource).toContain('linkedItemTemplateId ? "followup" : "manual"');
    // And the three actions resolve to the store's snooze/complete/dismiss transitions.
    expect(promptSource).toContain("closeWith(completeFollowup);");
    expect(promptSource).toContain("closeWith(snoozeFollowup)");
    expect(promptSource).toContain("closeWith(dismissFollowup)");
  });

  it("persists the follow-up store under its own key with defensive rehydration", () => {
    const storeSource = source("src/commerce/purchase-followup.store.ts");
    expect(storeSource).toContain('name: "wooriai-purchase-followup"');
    expect(storeSource).toContain("createJSONStorage(() => persistStorage)");
    expect(storeSource).toContain("migrate:");
    expect(storeSource).toContain("merge:");
  });
});
