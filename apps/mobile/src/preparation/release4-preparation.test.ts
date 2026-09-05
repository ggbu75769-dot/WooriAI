import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSeoulToday } from "@wooriai/domain";
import { beforeEach, describe, expect, it } from "vitest";
import { LOCAL_CHILD_ID, LOCAL_MOTHER_PROFILE_ID, LOCAL_USER_ID } from "../api/local-fixtures";
import { addCatalogItemPlanComment, applyCatalogBundle, createChild, getCatalogContexts, getCatalogItem, getCatalogItemPlanActivity, getCatalogTimeline, getPreparationContext, listCatalogBundles, listCatalogDomains, listCatalogItems, putCatalogItemPlan, putMotherCatalogItemPlan, resetLocalBackendForTests, updatePreparationContext } from "../api/local-backend";

describe("Release 4 preparation experience", () => {
  beforeEach(() => resetLocalBackendForTests());

  it("exposes 24 domains and 409 need definitions without requiring sellable products", () => {
    expect(listCatalogDomains().domains).toHaveLength(24);
    const catalog = listCatalogItems({ childId: LOCAL_CHILD_ID, limit: 100 });
    expect(catalog.total).toBe(409);
    expect(catalog.items).toHaveLength(100);
    const carSeat = listCatalogItems({ childId: LOCAL_CHILD_ID, query: "신생아용 카시트 준비" }).items[0];
    expect(carSeat).toMatchObject({ nameKo: "신생아용 카시트", safetyTier: "high", recommendationState: "professional_review_required" });
    expect(getCatalogItem(carSeat.id, LOCAL_CHILD_ID).offers).toEqual([]);
    expect(listCatalogItems({ query: "역방쿠" }).items[0]).toMatchObject({ nameKo: "역류방지쿠션", safetyTier: "high" });
  });

  it("persists states beyond the legacy prepared/not-needed set", () => {
    const item = listCatalogItems({ childId: LOCAL_CHILD_ID, query: "아기 보드북" }).items[0];
    const planned = putCatalogItemPlan(LOCAL_CHILD_ID, item.id, { state: "planned", acquisitionMode: "secondhand", desiredQuantity: 2 });
    expect(planned).toMatchObject({ state: "planned", acquisitionMode: "secondhand", desiredQuantity: 2, version: 1 });
    expect(listCatalogItems({ childId: LOCAL_CHILD_ID, state: "planned" }).items.map((entry) => entry.id)).toContain(item.id);
    const owned = putCatalogItemPlan(LOCAL_CHILD_ID, item.id, { state: "owned", ownedQuantity: 2, expectedVersion: 1 });
    expect(owned).toMatchObject({ state: "owned", ownedQuantity: 2, version: 2 });
  });

  it("persists inventory, assignment, repeat-cycle, comments, history, and CAS in the offline adapter", () => {
    const item = listCatalogItems({ childId: LOCAL_CHILD_ID, query: "아기 보드북" }).items[0]!;
    const created = putCatalogItemPlan(LOCAL_CHILD_ID, item.id, {
      state: "planned", quantityNeeded: 3, quantityOwned: 1, acquisitionType: "secondhand", assignedUserId: LOCAL_USER_ID,
      budgetKrw: 45000, notes: "가족과 비교", size: "120", variant: "중립", purchasedAt: "2026-07-01", replacementDueAt: "2027-07-01",
      storageLocation: "현관", recurringIntervalDays: 30, nextPurchaseDueAt: "2026-07-31"
    });
    expect(created).toMatchObject({ desiredQuantity: 3, ownedQuantity: 1, acquisitionMode: "secondhand", budgetKrw: 45000, size: "120", storageLocation: "현관", recurringIntervalDays: 30, version: 1 });
    expect(() => putCatalogItemPlan(LOCAL_CHILD_ID, item.id, { state: "owned" })).toThrow(/다른 기기/);
    addCatalogItemPlanComment(LOCAL_CHILD_ID, item.id, "가족 공동 준비 댓글");
    const activity = getCatalogItemPlanActivity(LOCAL_CHILD_ID, item.id);
    expect(activity.history).toHaveLength(1);
    expect(activity.history[0]).toMatchObject({ fromVersion: null, toVersion: 1 });
    expect(activity.comments).toEqual([expect.objectContaining({ body: "가족 공동 준비 댓글", authorDisplayName: "테스트 사용자" })]);
    expect(getCatalogItem(item.id, LOCAL_CHILD_ID).plan).toMatchObject({ quantityNeeded: 3, quantityOwned: 1, assignedUserId: LOCAL_USER_ID, size: "120", recurringIntervalDays: 30 });
  });

  it("filters optional family scenarios and keeps medical contexts review-gated", () => {
    expect(listCatalogItems({ contextCode: "second_or_later", limit: 100 }).items.length).toBeGreaterThan(0);
    const medical = listCatalogItems({ contextCode: "preterm_or_nicu", limit: 100 }).items;
    expect(medical.length).toBeGreaterThan(0);
    expect(medical.every((item) => item.safetyTier === "high" && item.recommendationState === "professional_review_required")).toBe(true);
  });

  it("keeps maternal plans separate from child plans in the offline adapter", () => {
    const motherProfileId = LOCAL_MOTHER_PROFILE_ID;
    expect(getCatalogContexts().motherProfiles).toContainEqual(expect.objectContaining({ id: motherProfileId, active: true }));
    const item = listCatalogItems({ motherProfileId, lifecycleAxis: "mother", limit: 1 }).items[0];
    putMotherCatalogItemPlan(motherProfileId, item.id, { state: "researching" });
    expect(getCatalogItem(item.id, undefined, motherProfileId).plan).toMatchObject({ state: "researching" });
    expect(getCatalogItem(item.id, LOCAL_CHILD_ID).plan).toBeNull();
  });

  it("uses the same explainable lifecycle timeline contract in the offline adapter", () => {
    const timeline = getCatalogTimeline(LOCAL_CHILD_ID);
    expect(timeline.rankingPolicy).toBe("user_due_then_timeline_then_lifecycle_priority_then_context_then_necessity_no_commerce_signal");
    expect(timeline.context).toMatchObject({ lifecycleAxis: "child", lifecycleCode: "toddler_2_3y", nextLifecycleCode: "preschool_4_5y" });
    expect(timeline.buckets.this_week.length).toBeGreaterThan(0);
    expect(timeline.buckets.this_week[0]).toEqual(expect.objectContaining({
      recommendationReasonCode: expect.any(String),
      recommendationReason: expect.not.stringMatching(/toddler_2_3y|pregnancy_late|first_child/),
      dueWindow: expect.objectContaining({ derivedFrom: "lifecycle" })
    }));

    const first = timeline.buckets.this_week[0];
    putCatalogItemPlan(LOCAL_CHILD_ID, first.id, { state: "owned" });
    expect(getCatalogTimeline(LOCAL_CHILD_ID).buckets.completed.map((item) => item.id)).toContain(first.id);
  });

  it("keeps newborn essentials first and documents out of the personalized top 20", () => {
    const child = createChild({ nickname: "신생아", stageMode: "manual", manualStage: "newborn_0_3" });
    const ranked = Object.values(getCatalogTimeline(child.id).buckets).flat();
    expect(ranked.slice(0, 8).map((item) => item.nameKo)).toEqual([
      "신생아 기저귀",
      "신생아 침대",
      "단단한 아기 매트리스",
      "고정형 매트리스 시트",
      "아기 체온계",
      "신생아 욕조",
      "후드형 아기 타월",
      "신생아 배냇저고리"
    ]);
    expect(ranked.slice(0, 20).map((item) => item.nameKo).join(" ")).not.toMatch(/계획|서류|파일|기록표|일정표/);
    expect(ranked.slice(0, 20).map((item) => item.nameKo)).toEqual(expect.arrayContaining(["신생아 아기띠", "신생아 유모차"]));
  });

  it("promotes feeding and vehicle essentials only when their family context matches", () => {
    const child = createChild({ nickname: "맥락", stageMode: "manual", manualStage: "newborn_0_3" });
    updatePreparationContext(child.id, undefined, { contextCodes: ["formula_feeding", "car_primary"] });
    const contextual = Object.values(getCatalogTimeline(child.id).buckets).flat().slice(0, 5).map((item) => item.nameKo);
    expect(contextual).toEqual(expect.arrayContaining(["젖병", "분유 보관 용기", "월령별 젖꼭지", "신생아용 카시트"]));

    resetLocalBackendForTests();
    const noCarChild = createChild({ nickname: "대중교통", stageMode: "manual", manualStage: "newborn_0_3" });
    updatePreparationContext(noCarChild.id, undefined, { contextCodes: ["no_car"] });
    const noCarRows = Object.values(getCatalogTimeline(noCarChild.id).buckets).flat();
    expect(noCarRows.findIndex((item) => item.nameKo === "신생아 아기띠")).toBeLessThan(noCarRows.findIndex((item) => item.nameKo === "신생아용 카시트"));

    expect(listCatalogItems({ contextCode: "breastfeeding", limit: 20 }).items.map((item) => item.nameKo)).toContain("수유 쿠션");
  });

  it("ranks an explicit user due date ahead of editorial order in the same urgency bucket", () => {
    const child = createChild({ nickname: "마감", stageMode: "manual", manualStage: "newborn_0_3" });
    const lowEditorialItem = listCatalogItems({ childId: child.id, query: "아기 보드북" }).items[0]!;
    putCatalogItemPlan(child.id, lowEditorialItem.id, { state: "planned", dueDate: getSeoulToday() });
    expect(getCatalogTimeline(child.id).buckets.this_week[0]?.nameKo).toBe("아기 보드북");
  });

  it("does not force a middle-school standalone persona into the newborn lifecycle", async () => {
    const localBackend = await import("../api/local-backend");
    localBackend.resetLocalBackendForTests();
    const child = localBackend.createChild({
      nickname: "중학생",
      stageMode: "manual",
      manualStage: "middle_school"
    });
    const timeline = localBackend.getCatalogTimeline(child.id);
    expect(timeline.context.lifecycleCode).toBe("middle_school");
    expect(timeline.context.lifecycleCode).not.toContain("newborn");
    expect(Object.values(timeline.buckets).flat().every((item) => !item.recommendationReason.includes("middle_school"))).toBe(true);
  });

  it("persists preparation context choices with CAS and applies them to local timeline reasons", () => {
    expect(getPreparationContext(LOCAL_CHILD_ID)).toMatchObject({ contextCodes: [], version: 0 });
    const created = updatePreparationContext(LOCAL_CHILD_ID, undefined, { contextCodes: ["small_home", "budget_saving", "small_home"] });
    expect(created).toMatchObject({ contextCodes: ["budget_saving", "small_home"], version: 1 });
    expect(() => updatePreparationContext(LOCAL_CHILD_ID, undefined, { contextCodes: ["no_car"] })).toThrow(/다른 가족/);
    expect(() => updatePreparationContext(LOCAL_CHILD_ID, undefined, { contextCodes: ["car_primary", "no_car"], expectedVersion: 1 })).toThrow(/함께 선택/);
    const timeline = getCatalogTimeline(LOCAL_CHILD_ID);
    expect(timeline.context).toMatchObject({ selectedContextCodes: ["budget_saving", "small_home"], contextVersion: 1 });
    const rows = Object.values(timeline.buckets).flat();
    expect(rows.some((item) => item.matchedContextCodes.includes("small_home") || item.matchedContextCodes.includes("budget_saving"))).toBe(true);
    expect(rows.find((item) => item.matchedContextCodes.length > 0)?.recommendationReason).toContain("상황");
  });

  it("selects canonical bundle members and keeps duplicate-purchase warnings in the offline adapter", () => {
    const bundle = listCatalogBundles(LOCAL_CHILD_ID).bundles.find((entry) => entry.items.length >= 2)!;
    expect(bundle.progress).toMatchObject({ totalCount: bundle.items.length, completedCount: 0, percentage: 0 });
    const selected = bundle.items.slice(0, 2).map((item) => ({ itemId: item.id, state: "planned" as const, quantityNeeded: item.defaultQuantity ?? 1 }));
    expect(applyCatalogBundle(LOCAL_CHILD_ID, bundle.id, { dryRun: true, items: selected })).toMatchObject({ selectedCount: 2, appliedCount: 0, warnings: [] });
    expect(applyCatalogBundle(LOCAL_CHILD_ID, bundle.id, { dryRun: false, items: selected }).plans).toHaveLength(2);
    putCatalogItemPlan(LOCAL_CHILD_ID, selected[0]!.itemId, { state: "owned", expectedVersion: 1 });
    const warning = applyCatalogBundle(LOCAL_CHILD_ID, bundle.id, { dryRun: true, items: [{ ...selected[0]!, expectedVersion: 2 }] });
    expect(warning.warnings).toContainEqual(expect.objectContaining({ code: "DUPLICATE_PURCHASE_RISK", currentState: "owned" }));
  });

  it("keeps Pixel Lock transforms out of the production preparation components", () => {
    const root = process.cwd();
    const listSource = readFileSync(join(root, "src/preparation/Release4PreparationScreen.tsx"), "utf8");
    const paritySource = readFileSync(join(root, "src/preparation/PreparationListParity.tsx"), "utf8");
    const detailSource = readFileSync(join(root, "src/preparation/Release4ItemDetailScreen.tsx"), "utf8");
    const tabsSource = readFileSync(join(root, "app/(tabs)/_layout.tsx"), "utf8");
    expect(listSource).toContain('testID="release4-preparation-screen"');
    expect(detailSource).toContain('testID="release4-item-detail-screen"');
    expect(listSource).not.toContain("transform:");
    expect(detailSource).not.toContain("transform:");
    expect(listSource).toContain('useState<PreparationSurface>("list")');
    expect(paritySource).toContain("PreparationItemCard");
    expect(listSource).toContain("ItemStatusControl");
    expect(paritySource).toContain("compactGridColumnCount(width, fontScale)");
    expect(paritySource).toContain("compactGridItemWidth(columns)");
    expect(paritySource).toContain("autoExpandedContext.current === selectedContextKey");
    expect(paritySource).not.toContain("expandedGroups.size === 0");
    expect(listSource).toContain('setStatusDraft(current ?? "researching")');
    expect(listSource).not.toContain('current === "replaced"');
    expect(listSource).toContain("const statusChanged = Boolean");
    expect(listSource).toContain("준비 상태를 저장하지 않았어요");
    expect(listSource).toContain('statusChanged ? "준비 상태 저장" : "변경 없음"');
    expect(listSource).toContain("WeeklyPreparationSection");
    expect(readFileSync(join(root, "src/preparation/PreparationOverview.tsx"), "utf8")).toContain("최대 5개");
    expect(detailSource).toContain("상품이 없어도 준비 상태와 예산은 계속 관리");
    expect(detailSource).toContain("가격 확인");
    expect(detailSource).toContain("priceCheckedAt");
    expect(listSource).toContain("누구의 준비인가요?");
    expect(listSource).toContain("putMotherItemPlan");
    expect(listSource).toContain("getCatalogTimeline");
    expect(listSource).toContain("listCatalogBundles");
    expect(listSource).toContain("중복 구매 가능성이 있어요");
    expect(listSource).toContain("recommendationReason");
    expect(listSource).toContain("PreparationOverviewLinks");
    expect(tabsSource).toContain('items: { title: "준비템"');
  });
});
