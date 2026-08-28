/**
 * QA-DEMO-JOURNEY: end-to-end demo (local-backend) user journey, driven entirely through the
 * public API-client surface (src/api/client.ts) with LOCAL_SESSION_TOKEN -- the closest thing to
 * a device walkthrough that runs under vitest. Every call below goes through the exact same
 * client functions the screens call; the local backend behind them is the same persisted zustand
 * store the standalone/demo APK uses (in-memory under node, see src/stores/persist-storage.ts).
 *
 * The journey is one ordered `describe` -- vitest runs `it`s sequentially within a file, and each
 * step deliberately builds on the state left by the previous one (login -> onboarding -> expenses
 * -> items -> commerce -> reports -> import -> categories -> sync), exactly like a real device
 * session would. `beforeAll` wipes the persisted local-backend store via the same
 * `resetLocalBackendForTests()` helper the existing local-backend tests use, so runs are isolated.
 *
 * Steps that CANNOT be exercised against the local backend (no production source was modified for
 * this ticket) are noted inline as SKIPPED-STEP comments:
 *
 *   SKIPPED STEP (1, partially) -- oauthLogin: src/api/client.ts's oauthLogin() has no local-token
 *   branch; it always POSTs to the real `${API_BASE_URL}/auth/oauth-login` dev stub. The demo
 *   journey instead establishes its session the way the demo APK actually does: via
 *   useSessionStore.startTestSession() + LOCAL_SESSION_TOKEN (see src/test-login-flow.test.ts).
 *
 *   STEP 2 note -- "patch child": 로컬 백엔드는 아이를 한 명만 들 수 있어, createChild()는
 *   언제나 LOCAL_CHILD_ID를 돌려주고 그 한 자리를 새 프로필로 교체한다. 단계 입력(임신 중/
 *   태어남/직접 선택 + 날짜)은 이어지는 updateChild가 채운다 -- 온보딩이 실제로 타는 경로가
 *   src/onboarding/child-create.ts이고, step 2c가 그 경로를 그대로 부른다.
 *
 *   SKIPPED STEP (9, partially) -- devices: no device-registration/list function exists anywhere
 *   in src/api/client.ts (server-only concern, if it exists at all).
 *
 *   SKIPPED STEP (9, partially) -- analytics: src/analytics/client.ts flushes its queue with a
 *   raw fetch() to `${API_BASE_URL}/analytics/events`; the local backend implements no analytics
 *   sink, so analytics delivery is server-only. (Sync IS implemented locally -- exercised below.)
 */
import { beforeAll, describe, expect, it } from "vitest";
import { getSeoulToday } from "@wooriai/domain";
import {
  ExpenseVersionConflictError,
  LOCAL_SESSION_TOKEN,
  clickProductLink,
  confirmImport,
  createExcelImport,
  createExpense,
  deleteExpense,
  deleteExpenseWithVersion,
  getBudget,
  getCategoryReport,
  getCumulativeReport,
  getExpense,
  getHome,
  getImportJob,
  getItemDetail,
  getMilestoneReport,
  getMonthlyReport,
  getOnboardingProgress,
  getSyncChanges,
  getYearlyReport,
  listCategories,
  listChildren,
  listExpenses,
  listImportRows,
  listItems,
  setPreparedItems,
  updateExpenseWithVersion,
  updateImportRow,
  updateItemStatus,
  upsertBudget,
  upsertConsents,
  type Expense
} from "../api/client";
import { resetLocalBackendForTests, seedLocalDemoFixturesForTests, useLocalBackendStore } from "../api/local-backend";
import { buildCreateChildBody } from "../children/child-form";
import { createOnboardingChild } from "../onboarding/child-create";
import { hasResumeWorthyProgress, routeForOnboardingNextStep } from "../onboarding/resume";
import {
  LOCAL_CATEGORY_IMPORT,
  LOCAL_CHILD_ID,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_ITEM_BLOCKS,
  LOCAL_ITEM_CARRIER,
  LOCAL_ITEM_DIAPER,
  localImportStubRows,
  localItemTemplateFixtures,
  localProductLinkFixtures
} from "../api/local-fixtures";
import { categoryCatalog } from "../categories";
import { useSessionStore } from "../stores/session.store";
import { useSelectedChildStore } from "../stores/selected-child.store";

const token = LOCAL_SESSION_TOKEN;
const childId = LOCAL_CHILD_ID;
const today = getSeoulToday();
const currentYearMonth = today.slice(0, 7);
/**
 * Journey observation (not fixed here -- tests only): the demo backend's Budget.yearMonth /
 * MonthlyReport.yearMonth come back as "YYYY-MM-01", not "YYYY-MM" -- @wooriai/domain's
 * `SeoulMonthRange.yearMonth` is (despite its name) the first-of-month DATE, and
 * local-backend.ts's budgetKey()/getMonthlyReport() pass it through verbatim. Any screen
 * comparing that field against a "YYYY-MM" string would mismatch in demo mode.
 */
const currentMonthKey = `${currentYearMonth}-01`;
const currentYear = Number(today.slice(0, 4));

const JOURNEY_BUDGET_KRW = 2_000_000;

// Mutable journey context shared across the ordered steps below (vitest runs the `it`s in this
// file strictly in declaration order).
const journey: {
  editedExpense: Expense | null;
  deletedWithVersionId: string | null;
  legacyDeletedId: string | null;
  giftExpenseId: string | null;
  importedItemNames: string[];
} = {
  editedExpense: null,
  deletedWithVersionId: null,
  legacyDeletedId: null,
  giftExpenseId: null,
  importedItemNames: []
};

async function currentMonthTotal(): Promise<number> {
  return (await listExpenses(token, childId)).totalAmountKrw;
}

/** All-time expense-type total, as the Home screen shows it. */
async function allTimeTotal(): Promise<number> {
  return (await getHome(token, childId)).totalExpenseKrw;
}

describe("QA-DEMO-JOURNEY: full demo user journey through the API client (local backend)", () => {
  beforeAll(() => {
    // Same isolation pattern as src/local-backend.test.ts: wipe the persisted local-backend
    // store, and start from a logged-out session store.
    //
    // 실기기 피드백 1: 테스트 로그인 자체는 이제 데이터 0에서 시작한다(step 1 참고). 이 여정은
    // "이미 기록이 쌓인 데모 세션"을 처음부터 끝까지 훑는 것이 목적이라, 그 상태를 arrange
    // 헬퍼로 명시적으로 만들어 둔다 -- 예전에는 로그인만 해도 자동으로 만들어지던 것이다.
    resetLocalBackendForTests();
    seedLocalDemoFixturesForTests();
    useSessionStore.getState().clearSession();
  });

  // -------------------------------------------------------------------------
  // Step 1 -- establish the demo session context
  // -------------------------------------------------------------------------
  it("step 1: establishes the demo session (test login), never minting fake OAuth tokens", () => {
    // SKIPPED-STEP note: oauthLogin() is server-only (no LOCAL_SESSION_TOKEN branch) -- see the
    // file header. startTestSession() is the demo APK's real login path.
    useSessionStore.getState().startTestSession();

    const session = useSessionStore.getState();
    expect(session.isTestSession).toBe(true);
    // The local test-login contract: real token/identity fields stay null; screens route calls
    // to the local backend by passing LOCAL_SESSION_TOKEN explicitly.
    expect(session.accessToken).toBeNull();
    expect(session.refreshToken).toBeNull();
    expect(session.userId).toBeNull();
    expect(session.defaultHouseholdId).toBeNull();
    // 실기기 피드백 1: 테스트 로그인 자체는 더 이상 아이를 만들지도 고르지도 않는다. 이
    // 여정은 beforeAll에서 아이가 있는 세션을 arrange 했으므로, startTestSession은 이미 있는
    // 그 아이를 골라 준다(아이가 없으면 selectedChildId는 null로 남고 온보딩이 정한다).
    expect(useSelectedChildStore.getState().selectedChildId).toBe(LOCAL_CHILD_ID);
  });

  // -------------------------------------------------------------------------
  // Step 2 -- onboarding: status -> consents -> child -> prepared items -> budget -> home
  // -------------------------------------------------------------------------
  it("step 2a: onboarding starts at the consents step on a fresh demo install", async () => {
    const progress = await getOnboardingProgress(token);
    expect(progress.completed).toBe(false);
    expect(progress.nextStep).toBe("consents");
    expect(progress.canRestart).toBe(true);
    expect(progress.summary.consentsAccepted).toBe(false);
  });

  it("step 2b: accepting consents advances onboarding to the prepared-items step", async () => {
    const result = await upsertConsents(token);
    expect(result.success).toBe(true);

    const progress = await getOnboardingProgress(token);
    expect(progress.completed).toBe(false);
    // 이 여정은 아이가 있는 세션을 arrange 했으므로 child-profile 단계는 이미 충족돼 있다.
    // 실제 테스트 로그인(및 실계정)은 아이가 없어 여기서 "child-profile"을 본다.
    expect(progress.nextStep).toBe("prepared-items");
    expect(progress.canRestart).toBe(false);
    expect(progress.summary.consentsAccepted).toBe(true);
    expect(progress.summary.child).toMatchObject({ id: LOCAL_CHILD_ID, stageMode: "born" });
    expect(progress.summary.preparedItemsCount).toBeNull();
  });

  /**
   * 실기기 피드백 1: 온보딩 ONB-002가 실제로 타는 경로(src/onboarding/child-create.ts)를 그대로
   * 부른다 -- 별명만 넘기는 createChild 뒤에 단계 입력(여기서는 출생일)이 이어 붙는다. 예전에는
   * 시드가 만들어 둔 아이의 이름만 갈아 끼웠기 때문에, 사용자가 입력한 시기 정보가 데모
   * 세션에서는 어디에도 남지 않았다.
   */
  it("step 2c: 온보딩이 아이를 직접 만들고 입력한 시기 정보가 그대로 남는다", async () => {
    // 이어지는 단계(현재 시기 = 걸음마기, 지난 100일 창)를 그대로 두려고 같은 출생일을 쓴다.
    const birthDate = (await listChildren(token)).children[0].birthDate!;

    const created = await createOnboardingChild(
      token,
      buildCreateChildBody(LOCAL_HOUSEHOLD_ID, "born", { nickname: "여정이", dateText: birthDate, manualStage: null })
    );
    // 로컬 백엔드는 아이를 한 명만 들 수 있어 언제나 같은 id다(두 번째 아이가 생기지 않는다).
    expect(created.id).toBe(LOCAL_CHILD_ID);
    expect((await listChildren(token)).children).toHaveLength(1);
    expect((await listChildren(token)).children[0]).toMatchObject({
      nickname: "여정이",
      stageMode: "born",
      birthDate,
      dueDate: null
    });

    const home = await getHome(token, childId);
    expect(home.child.id).toBe(LOCAL_CHILD_ID);
    expect(home.child.nickname).toBe("여정이");
    // stage is computed from the birthDate the user just entered (~24 months ago).
    expect(home.child.currentStage).toBe("toddler_1_3");
    expect(home.child.stageLabel).toBeTruthy();
  });

  /**
   * 라운드 51 #2: 여기서 앱을 껐다 켜면(= 콜드 스타트) 어떤 화면으로 가는가.
   *
   * app/index.tsx는 이제 데모 세션에서도 진행도를 물어보고, 그 답이 "아이는 있고 준비물 단계가
   * 남았다"이면 ONB-006 이어하기를 거쳐 ONB-003으로 건너뛴다. 예전에는 이 조회 자체가
   * `isTestSession`으로 막혀 있어 ONB-001로 돌아갔고, 거기서 다시 만든 아이가 로컬의 한 자리를
   * 통째로 교체해(createChild) 방금 입력한 태명("여정이")이 사라졌다.
   *
   * 이 단계는 읽기만 하므로 여정의 상태를 건드리지 않는다 -- 다음 step 2d가 그대로 이어진다.
   */
  it("step 2c-r: 지금 앱을 껐다 켜면 이어하기가 ONB-003으로 보내고 입력한 태명이 남는다", async () => {
    const progress = await getOnboardingProgress(token);
    expect(progress.completed).toBe(false);
    expect(progress.nextStep).toBe("prepared-items");
    expect(progress.summary.child).toMatchObject({ id: LOCAL_CHILD_ID, nickname: "여정이" });
    // 데모 세션의 이어하기 판정(src/onboarding/resume.ts) -- 아이를 만들었으므로 대상이다.
    expect(hasResumeWorthyProgress(progress, true)).toBe(true);
    // ONB-006 "이어서 하기"의 목적지: 아이 생성 화면을 다시 타지 않는다.
    expect(routeForOnboardingNextStep(progress.nextStep)).toBe("/onboarding/prepared-items");
    // 그래서 태명은 그대로다(아이를 다시 만들지 않으므로 교체가 일어나지 않는다).
    expect((await listChildren(token)).children[0].nickname).toBe("여정이");
  });

  it("step 2d: submitting prepared items completes the step and is counted in the summary", async () => {
    const result = await setPreparedItems(token, childId, [LOCAL_ITEM_DIAPER]);
    expect(result.updatedCount).toBe(1);

    // The demo backend seeds the current month's budget; clear it (test-only store poke, same
    // pattern as resetLocalBackendForTests) so the real "budget not set yet" onboarding state
    // and getBudget()'s null contract are observable through the client API.
    useLocalBackendStore.setState({ budgets: {} });

    const progress = await getOnboardingProgress(token);
    expect(progress.completed).toBe(false);
    expect(progress.nextStep).toBe("budget");
    expect(progress.summary.preparedItemsCount).toBe(1);
    expect(progress.summary.budget).toBeNull();
  });

  it("step 2e: getBudget resolves null while unset, and upsertBudget finishes onboarding", async () => {
    // "Budget not set" is a normal state, surfaced as null -- not a thrown error.
    await expect(getBudget(token, childId)).resolves.toBeNull();

    const monthTotalBefore = await currentMonthTotal();
    const budget = await upsertBudget(token, childId, JOURNEY_BUDGET_KRW);
    expect(budget.yearMonth).toBe(currentMonthKey); // "YYYY-MM-01" -- see currentMonthKey note
    expect(budget.amountKrw).toBe(JOURNEY_BUDGET_KRW);
    // Budget arithmetic: used == this month's expense total, remaining == amount - used.
    expect(budget.usedAmountKrw).toBe(monthTotalBefore);
    expect(budget.remainingAmountKrw).toBe(JOURNEY_BUDGET_KRW - monthTotalBefore);

    const progress = await getOnboardingProgress(token);
    expect(progress.completed).toBe(true);
    expect(progress.nextStep).toBe("home");
    expect(progress.summary.budget).toEqual({ yearMonth: currentMonthKey, amountKrw: JOURNEY_BUDGET_KRW });
  });

  // -------------------------------------------------------------------------
  // Step 3 -- expenses: create, list/home consistency, versioned edit, conflict, delete
  // -------------------------------------------------------------------------
  it("step 3a: a created expense appears in the list and moves every total by exactly its amount", async () => {
    const listBefore = await listExpenses(token, childId);
    const allTimeBefore = await allTimeTotal();

    const created = await createExpense(token, childId, {
      categoryId: categoryCatalog[0].id,
      amountKrw: 12_000,
      spentOn: today,
      itemName: "여정 테스트 물티슈",
      memo: "journey step 3"
    });
    expect(created.version).toBe(1);
    expect(created.source).toBe("manual");
    journey.editedExpense = created;

    const listAfter = await listExpenses(token, childId);
    expect(listAfter.expenses.some((expense) => expense.id === created.id)).toBe(true);
    expect(listAfter.totalAmountKrw).toBe(listBefore.totalAmountKrw + 12_000);
    expect(listAfter.expenses).toHaveLength(listBefore.expenses.length + 1);

    // Home summary stays arithmetically consistent with the list on both scopes.
    const home = await getHome(token, childId);
    expect(home.totalExpenseKrw).toBe(allTimeBefore + 12_000);
    expect(home.monthly.usedAmountKrw).toBe(listAfter.totalAmountKrw);
    expect(home.monthly.amountKrw).toBe(JOURNEY_BUDGET_KRW);
    expect(home.monthly.remainingAmountKrw).toBe(JOURNEY_BUDGET_KRW - listAfter.totalAmountKrw);
    // Newest-first: the expense spent today must lead the recent list.
    expect(home.recentExpenses[0]?.spentOn).toBe(today);
  });

  it("step 3b: a gift-type expense is listed but never counted in the expense totals", async () => {
    const totalBefore = await currentMonthTotal();
    const gift = await createExpense(token, childId, {
      categoryId: categoryCatalog[7].id,
      amountKrw: 50_000,
      spentOn: today,
      itemName: "선물 받은 내복",
      expenseType: "gift"
    });
    journey.giftExpenseId = gift.id;

    const list = await listExpenses(token, childId);
    expect(list.expenses.some((expense) => expense.id === gift.id)).toBe(true);
    expect(list.totalAmountKrw).toBe(totalBefore);
  });

  it("step 3c: editing amount+category+spentOn with the right expectedVersion bumps the version", async () => {
    const target = journey.editedExpense!;
    const totalBefore = await currentMonthTotal();

    const updated = await updateExpenseWithVersion(
      token,
      target.id,
      { amountKrw: 15_000, categoryId: categoryCatalog[3].id, spentOn: today },
      target.version, // 1
      "journey-idem-edit-1"
    );
    expect(updated.version).toBe(target.version + 1);
    expect(updated.amountKrw).toBe(15_000);
    expect(updated.categoryId).toBe(categoryCatalog[3].id);
    expect(updated.spentOn).toBe(today);
    journey.editedExpense = updated;

    // +3,000 delta, and the detail fetch agrees with the returned record.
    expect(await currentMonthTotal()).toBe(totalBefore + 3_000);
    expect(await getExpense(token, target.id)).toEqual(updated);
  });

  it("step 3d: replaying the edit with the stale version fails with a typed conflict carrying the current snapshot", async () => {
    const target = journey.editedExpense!;
    const totalBefore = await currentMonthTotal();

    let caught: unknown;
    try {
      await updateExpenseWithVersion(token, target.id, { amountKrw: 99_999 }, 1, "journey-idem-edit-stale");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ExpenseVersionConflictError);
    const conflict = caught as ExpenseVersionConflictError;
    // The conflict's `current` snapshot is the live post-edit record, so the UI can offer merge.
    expect(conflict.current).toEqual(target);
    expect((conflict.current as Expense).version).toBe(2);

    // The stale write must not have changed anything.
    expect(await currentMonthTotal()).toBe(totalBefore);
    expect((await getExpense(token, target.id)).amountKrw).toBe(15_000);
  });

  it("step 3e: versioned delete removes an expense; deleting the tombstone again conflicts with a deleted snapshot", async () => {
    const victim = await createExpense(token, childId, {
      categoryId: categoryCatalog[1].id,
      amountKrw: 5_500,
      spentOn: today,
      itemName: "삭제될 여정 지출"
    });
    journey.deletedWithVersionId = victim.id;
    const totalBefore = await currentMonthTotal();

    const deleted = await deleteExpenseWithVersion(token, victim.id, victim.version, "journey-idem-del-1");
    expect(deleted.success).toBe(true);
    expect(await currentMonthTotal()).toBe(totalBefore - 5_500);
    await expect(getExpense(token, victim.id)).rejects.toThrow();

    // Soft-delete bumped the version to 2; a stale delete replay reports the tombstone.
    let caught: unknown;
    try {
      await deleteExpenseWithVersion(token, victim.id, victim.version, "journey-idem-del-stale");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ExpenseVersionConflictError);
    expect((caught as ExpenseVersionConflictError).current).toEqual({ id: victim.id, deleted: true, version: 2 });
  });

  it("step 3f: the legacy (unversioned) delete path also removes an expense and its amount", async () => {
    const victim = await createExpense(token, childId, {
      categoryId: categoryCatalog[2].id,
      amountKrw: 4_400,
      spentOn: today,
      itemName: "레거시 삭제 지출"
    });
    journey.legacyDeletedId = victim.id;
    const totalBefore = await currentMonthTotal();

    const deleted = await deleteExpense(token, victim.id);
    expect(deleted.success).toBe(true);
    expect(await currentMonthTotal()).toBe(totalBefore - 4_400);
  });

  // -------------------------------------------------------------------------
  // Step 4 -- items: stage tabs, status transitions, detail fetch
  // -------------------------------------------------------------------------
  it("step 4a: the now/soon tabs partition the recommendable items by the child's current stage", async () => {
    const stage = (await getHome(token, childId)).child.currentStage;
    const nowIds = (await listItems(token, childId, "now")).items.map((item) => item.id);
    const soonIds = (await listItems(token, childId, "soon")).items.map((item) => item.id);

    // The diaper was marked prepared during onboarding (step 2d) -- it must not be recommended.
    expect(nowIds).not.toContain(LOCAL_ITEM_DIAPER);
    expect(soonIds).not.toContain(LOCAL_ITEM_DIAPER);

    // Every other fixture item lands on exactly the tab its stageCodes dictate.
    for (const fixture of localItemTemplateFixtures.filter((item) => item.id !== LOCAL_ITEM_DIAPER)) {
      const expectedTab = fixture.stageCodes.includes(stage as (typeof fixture.stageCodes)[number]) ? nowIds : soonIds;
      const otherTab = expectedTab === nowIds ? soonIds : nowIds;
      expect(expectedTab).toContain(fixture.id);
      expect(otherTab).not.toContain(fixture.id);
    }

    // And the prepared tab reflects the onboarding selection.
    const prepared = await listItems(token, childId, "prepared");
    expect(prepared.items.map((item) => item.id)).toEqual([LOCAL_ITEM_DIAPER]);
  });

  it("step 4b: prepared / not_needed / interested transitions move items across tabs and back", async () => {
    // carrier -> prepared: joins the prepared tab, leaves the recommendation tabs.
    const preparedCarrier = await updateItemStatus(token, childId, LOCAL_ITEM_CARRIER, "prepared");
    expect(preparedCarrier.status).toBe("prepared");
    let preparedIds = (await listItems(token, childId, "prepared")).items.map((item) => item.id);
    expect(preparedIds).toContain(LOCAL_ITEM_CARRIER);
    expect((await listItems(token, childId, "now")).items.map((item) => item.id)).not.toContain(LOCAL_ITEM_CARRIER);

    // blocks -> not_needed: appears only on the not_needed tab.
    const skippedBlocks = await updateItemStatus(token, childId, LOCAL_ITEM_BLOCKS, "not_needed");
    expect(skippedBlocks.status).toBe("not_needed");
    expect((await listItems(token, childId, "not_needed")).items.map((item) => item.id)).toEqual([LOCAL_ITEM_BLOCKS]);
    expect((await listItems(token, childId, "soon")).items.map((item) => item.id)).not.toContain(LOCAL_ITEM_BLOCKS);

    // interested toggle: carrier goes back into the recommendation pool, flagged interested.
    const interestedCarrier = await updateItemStatus(token, childId, LOCAL_ITEM_CARRIER, "interested");
    expect(interestedCarrier.status).toBe("interested");
    const nowItems = (await listItems(token, childId, "now")).items;
    expect(nowItems.find((item) => item.id === LOCAL_ITEM_CARRIER)?.status).toBe("interested");
    preparedIds = (await listItems(token, childId, "prepared")).items.map((item) => item.id);
    expect(preparedIds).not.toContain(LOCAL_ITEM_CARRIER);

    // toggle off again: blocks -> not_prepared empties the not_needed tab.
    await updateItemStatus(token, childId, LOCAL_ITEM_BLOCKS, "not_prepared");
    expect((await listItems(token, childId, "not_needed")).items).toEqual([]);
  });

  it("step 4c: the item detail carries the current status, guidance copy, and ordered product links", async () => {
    const detail = await getItemDetail(token, childId, LOCAL_ITEM_DIAPER);
    expect(detail.id).toBe(LOCAL_ITEM_DIAPER);
    expect(detail.status).toBe("prepared");
    expect(detail.reasonText.length).toBeGreaterThan(0);
    expect(detail.usedSecondhandOk).toBe(false);

    const expectedLinks = localProductLinkFixtures
      .filter((link) => link.itemTemplateId === LOCAL_ITEM_DIAPER)
      .sort((left, right) => left.displayOrder - right.displayOrder);
    expect(detail.productLinks.map((link) => link.id)).toEqual(expectedLinks.map((link) => link.id));
    // Every affiliate/sponsored link must ship its mandatory disclosure copy.
    for (const link of detail.productLinks.filter((entry) => entry.isAffiliate || entry.isSponsored)) {
      expect(link.disclosureText).toBeTruthy();
    }
  });

  // -------------------------------------------------------------------------
  // Step 5 -- commerce: product link click tracking
  // -------------------------------------------------------------------------
  it("step 5: clicking product links returns a tracked click with the correct redirect target", async () => {
    const affiliateFixture = localProductLinkFixtures.find((link) => link.id === "local-link-diaper-affiliate")!;
    const affiliateClick = await clickProductLink(token, affiliateFixture.id, childId);
    expect(affiliateClick.clickId).toMatch(/^local-click-/);
    // Affiliate links must redirect through the affiliate URL, disclosure attached.
    expect(affiliateClick.redirectUrl).toBe(affiliateFixture.affiliateUrl);
    expect(affiliateClick.disclosureText).toBe(affiliateFixture.disclosureText);

    // A plain (non-affiliate) link redirects to the raw URL with no disclosure.
    const plainFixture = localProductLinkFixtures.find((link) => link.id === "local-link-blocks-naver")!;
    const plainClick = await clickProductLink(token, plainFixture.id, childId);
    expect(plainClick.redirectUrl).toBe(plainFixture.url);
    expect(plainClick.disclosureText).toBeUndefined();
    // Each click is individually tracked.
    expect(plainClick.clickId).not.toBe(affiliateClick.clickId);

    await expect(clickProductLink(token, "no-such-link", childId)).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Step 6 -- reports: monthly + category(period) + cumulative + yearly + milestone
  // -------------------------------------------------------------------------
  it("step 6a: the monthly report agrees exactly with the expense list and the budget", async () => {
    const list = await listExpenses(token, childId);
    const monthly = await getMonthlyReport(token, childId);

    expect(monthly.yearMonth).toBe(currentMonthKey); // "YYYY-MM-01" -- see currentMonthKey note
    expect(monthly.totalExpenseKrw).toBe(list.totalAmountKrw);
    expect(monthly.budgetAmountKrw).toBe(JOURNEY_BUDGET_KRW);

    // categoryTop is a complete, ordered breakdown of the month's expense-type spend.
    const breakdownSum = monthly.categoryTop.reduce((sum, entry) => sum + entry.amountKrw, 0);
    expect(breakdownSum).toBe(monthly.totalExpenseKrw);
    const expenseTypeCount = list.expenses.filter((expense) => expense.expenseType === "expense").length;
    expect(monthly.categoryTop.reduce((sum, entry) => sum + entry.count, 0)).toBe(expenseTypeCount);
    const amounts = monthly.categoryTop.map((entry) => entry.amountKrw);
    expect(amounts).toEqual([...amounts].sort((left, right) => right - left));

    // The edited expense's category (changed in step 3c) is attributed correctly.
    const editedCategory = monthly.categoryTop.find((entry) => entry.categoryId === categoryCatalog[3].id);
    expect(editedCategory?.amountKrw).toBe(15_000);
    // The versioned-deleted and legacy-deleted expenses are gone from the breakdown entirely.
    expect(monthly.categoryTop.some((entry) => entry.categoryId === categoryCatalog[1].id)).toBe(false);
    expect(monthly.categoryTop.some((entry) => entry.categoryId === categoryCatalog[2].id)).toBe(false);
  });

  it("step 6b: the category report honors its period parameter and matches the other reports", async () => {
    const monthly = await getMonthlyReport(token, childId);

    // Month-scoped (legacy string form): identical breakdown to the monthly report's.
    const monthScoped = await getCategoryReport(token, childId, currentYearMonth);
    expect(monthScoped.categories).toEqual(monthly.categoryTop);

    // Same month via the object form must agree with the string form.
    const monthScopedObject = await getCategoryReport(token, childId, { yearMonth: currentYearMonth });
    expect(monthScopedObject.categories).toEqual(monthScoped.categories);

    // All-time breakdown sums to the cumulative total.
    const cumulative = await getCumulativeReport(token, childId);
    const allTime = await getCategoryReport(token, childId);
    expect(allTime.categories.reduce((sum, entry) => sum + entry.amountKrw, 0)).toBe(cumulative.totalExpenseKrw);

    // Quarter scoping: the current quarter's breakdown covers at least this month's spend and
    // never exceeds the year's.
    const quarter = Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1;
    const quarterScoped = await getCategoryReport(token, childId, { year: currentYear, quarter });
    const yearScoped = await getCategoryReport(token, childId, { year: currentYear });
    const quarterSum = quarterScoped.categories.reduce((sum, entry) => sum + entry.amountKrw, 0);
    const yearSum = yearScoped.categories.reduce((sum, entry) => sum + entry.amountKrw, 0);
    expect(quarterSum).toBeGreaterThanOrEqual(monthly.totalExpenseKrw);
    expect(yearSum).toBeGreaterThanOrEqual(quarterSum);
  });

  it("step 6c: cumulative, yearly, and home totals are one consistent ledger", async () => {
    const cumulative = await getCumulativeReport(token, childId);
    // All-time total == sum of the per-year buckets == the Home screen's headline total.
    expect(cumulative.yearly.reduce((sum, year) => sum + year.amountKrw, 0)).toBe(cumulative.totalExpenseKrw);
    expect(cumulative.totalExpenseKrw).toBe(await allTimeTotal());

    const yearly = await getYearlyReport(token, childId, currentYear);
    expect(yearly.monthlyTotals).toHaveLength(12);
    expect(yearly.monthlyTotals.reduce((sum, month) => sum + month.totalExpenseKrw, 0)).toBe(yearly.totalExpenseKrw);
    // The current month's bucket must equal the monthly report's total.
    const monthly = await getMonthlyReport(token, childId);
    const currentMonthBucket = yearly.monthlyTotals.find((month) => month.yearMonth === currentYearMonth);
    expect(currentMonthBucket?.totalExpenseKrw).toBe(monthly.totalExpenseKrw);
  });

  it("step 6d: the milestone report aggregates only the true 100-day window", async () => {
    const milestone = await getMilestoneReport(token, childId, "d100");
    expect(milestone.type).toBe("d100");
    expect(milestone.childId).toBe(childId);
    // The demo child was born ~24 months ago, so the 100-day window is fully in the past.
    expect(milestone.partial).toBe(false);
    expect(milestone.daysCovered).toBe(100);
    expect(milestone.endDate > milestone.startDate).toBe(true);

    // 실기기 피드백 1: 예전에는 창 안에 기록이 없으면 저장된 **전체** 원장으로 대신 집계하는
    // 데모 폴백이 있었고, 이 단계는 그 폴백(= 누적 총액과 같은 값)을 고정하고 있었다. 이제
    // 기록은 전부 사용자가 직접 넣은 것이라 그 폴백은 "100일 리포트"라는 이름으로 100일과
    // 무관한 지출을 합치는 허위 표시가 된다 -- 창 밖 기록은 집계하지 않는다.
    const inWindow = (await listExpenses(token, childId, undefined)).expenses.filter(
      (expense) => expense.spentOn >= milestone.startDate && expense.spentOn <= milestone.endDate
    );
    expect(inWindow).toHaveLength(0); // 픽스처 지출은 전부 최근 며칠 -- 창(생후 0~100일) 밖이다.
    expect(milestone.totalKrw).toBe(0);
    expect(milestone.expenseCount).toBe(0);
    expect(milestone.topCategories).toEqual([]);
    // 0으로 나누지 않는다: 총액이 0이면 일평균도 0이다.
    expect(milestone.avgDailyKrw).toBe(0);

    // 누적/카테고리 리포트는 창과 무관하게 원장 전체를 계속 보여 준다(= 여기서 0이 아니다).
    expect((await getCumulativeReport(token, childId)).totalExpenseKrw).toBeGreaterThan(0);
    expect((await getCategoryReport(token, childId)).categories.length).toBeGreaterThan(0);

    // The first-birthday variant covers the whole first year.
    const firstBirthday = await getMilestoneReport(token, childId, "first-birthday");
    expect(firstBirthday.partial).toBe(false);
    expect(firstBirthday.daysCovered).toBeGreaterThanOrEqual(365);
  });

  // -------------------------------------------------------------------------
  // Step 7 -- excel import (the local backend DOES implement it -- not skipped)
  // -------------------------------------------------------------------------
  it("step 7: the excel import flow parses, revalidates on review, and imports exactly the selected rows", async () => {
    await expect(createExcelImport(token, childId, { uri: "file:///x", name: "notes.txt" })).rejects.toThrow();

    const job = await createExcelImport(token, childId, { uri: "file:///import", name: "wooriai-journey.csv" });
    expect(job.status).toBe("preview_ready");
    expect(job.rowCount).toBe(localImportStubRows.length);
    expect(job.importedCount).toBe(0);

    const { rows } = await listImportRows(token, job.id);
    expect(rows).toHaveLength(localImportStubRows.length);
    // The low-confidence stub row starts deselected and flagged for review.
    const lowConfidenceRow = rows.find((row) => row.confidence < 0.7)!;
    expect(lowConfidenceRow.selected).toBe(false);
    expect(lowConfidenceRow.validationStatus).toBe("low_confidence_duplicate_candidate");

    // Reviewing the row (user override) revalidates it to importable.
    const reviewed = await updateImportRow(token, job.id, lowConfidenceRow.id, { selected: true });
    expect(reviewed.selected).toBe(true);
    expect(reviewed.validationStatus).toBe("valid");

    const allTimeBefore = await allTimeTotal();
    const selectedIds = (await listImportRows(token, job.id)).rows.filter((row) => row.selected).map((row) => row.id);
    expect(selectedIds).toHaveLength(3);

    const confirmed = await confirmImport(token, job.id, selectedIds);
    expect(confirmed).toEqual({ importedCount: 3, skippedCount: 0 });

    // Exact arithmetic: the all-time total grows by the sum of the imported rows' amounts.
    const importedSum = localImportStubRows.reduce((sum, row) => sum + row.amountKrw, 0);
    expect(await allTimeTotal()).toBe(allTimeBefore + importedSum);
    journey.importedItemNames = localImportStubRows.map((row) => row.itemName);

    const finishedJob = await getImportJob(token, job.id);
    expect(finishedJob.status).toBe("confirmed");
    expect(finishedJob.importedCount).toBe(3);
    // A confirmed job can be neither re-confirmed (no duplicate expenses) nor re-edited.
    await expect(confirmImport(token, job.id, selectedIds)).rejects.toThrow();
    await expect(updateImportRow(token, job.id, lowConfidenceRow.id, { selected: false })).rejects.toThrow();
    expect(await allTimeTotal()).toBe(allTimeBefore + importedSum);
  });

  // -------------------------------------------------------------------------
  // Step 8 -- categories cover every category id the demo ledger uses
  // -------------------------------------------------------------------------
  it("step 8: listCategories resolves every categoryId used by any demo expense", async () => {
    const { categories } = await listCategories(token);
    const categoryIds = new Set(categories.map((category) => category.id));

    // Ordering guarantee mirrored from the real endpoint.
    const orders = categories.map((category) => category.displayOrder);
    expect(orders).toEqual([...orders].sort((left, right) => left - right));

    // Union of every category id the ledger references: seeded + created + edited + imported
    // (all-time category report) and everything visible this month.
    const allTimeBreakdown = (await getCategoryReport(token, childId)).categories;
    const monthList = await listExpenses(token, childId);
    const usedIds = new Set<string>([
      ...allTimeBreakdown.map((entry) => entry.categoryId),
      ...monthList.expenses.map((expense) => expense.categoryId)
    ]);
    expect(usedIds.size).toBeGreaterThan(0);
    for (const usedId of usedIds) {
      expect(categoryIds.has(usedId), `category ${usedId} must be resolvable`).toBe(true);
    }
    // The import flow's fixed category is covered too (even before any import ran).
    expect(categoryIds.has(LOCAL_CATEGORY_IMPORT)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Step 9 -- sync (implemented locally); devices/analytics are server-only (see header)
  // -------------------------------------------------------------------------
  it("step 9: sync/changes snapshots the full journey -- live upserts, versioned tombstones", async () => {
    const sync = await getSyncChanges(token);
    expect(sync.hasMore).toBe(false);
    expect(sync.nextCursor).not.toBeNull();

    const upsertsById = new Map(
      sync.changes.flatMap((change) => (change.op === "upsert" ? [[change.data.id, change.data] as const] : []))
    );
    const deletesById = new Map(
      sync.changes.flatMap((change) => (change.op === "delete" ? [[change.id, change] as const] : []))
    );

    // Every live expense the list shows is present as an upsert with identical content.
    const monthList = await listExpenses(token, childId);
    for (const expense of monthList.expenses) {
      expect(upsertsById.get(expense.id)).toEqual(expense);
    }

    // The edited expense syncs at version 2 with the post-edit amount.
    const edited = upsertsById.get(journey.editedExpense!.id)!;
    expect(edited).toMatchObject({ amountKrw: 15_000, version: 2 });

    // Both deletions arrive as tombstones (soft-delete bumped their version to 2), never upserts.
    for (const deletedId of [journey.deletedWithVersionId!, journey.legacyDeletedId!]) {
      expect(upsertsById.has(deletedId)).toBe(false);
      expect(deletesById.get(deletedId)).toMatchObject({ type: "expense", version: 2 });
      expect(deletesById.get(deletedId)?.deletedAt).toBeTruthy();
    }

    // The gift and the imported rows survived the journey and sync as live records.
    expect(upsertsById.get(journey.giftExpenseId!)?.expenseType).toBe("gift");
    const syncedNames = new Set([...upsertsById.values()].map((expense) => expense.itemName));
    for (const importedName of journey.importedItemNames) {
      expect(syncedNames.has(importedName)).toBe(true);
    }
    const importedRecords = [...upsertsById.values()].filter((expense) => journey.importedItemNames.includes(expense.itemName));
    expect(importedRecords).toHaveLength(journey.importedItemNames.length);
    for (const record of importedRecords) {
      expect(record.source).toBe("excel_import");
      expect(record.categoryId).toBe(LOCAL_CATEGORY_IMPORT);
    }

    // SKIPPED-STEP notes (server-only, see file header): device registration has no client API at
    // all, and analytics delivery (src/analytics/client.ts) posts to the real HTTP endpoint only.
  });
});
