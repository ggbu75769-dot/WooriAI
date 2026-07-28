import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_MONTHLY_BUDGET_WON } from "@wooriai/domain";
import { sanitizeOnboardingDraft, useOnboardingDraftStore } from "./stores/onboarding-draft.store";
import { secureOnboardingStorage } from "./stores/secure-onboarding-storage";

describe("Release 5U scoped onboarding draft", () => {
  beforeEach(() => useOnboardingDraftStore.getState().resetDraft());

  it("persists the schema v3 default and a user-edited monthly budget across restart", async () => {
    const storageKey = "wooriai-onboarding-draft";
    const store = useOnboardingDraftStore.getState();
    store.activateScope("budget-user", "budget-household");
    expect(useOnboardingDraftStore.getState().draft).toMatchObject({
      schemaVersion: 3,
      monthlyBudgetWon: DEFAULT_MONTHLY_BUDGET_WON,
      monthlyBudgetEdited: false
    });
    store.updateDraft({ monthlyBudgetWon: 750_000, monthlyBudgetEdited: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const persisted = await secureOnboardingStorage.getItem(storageKey);
    useOnboardingDraftStore.setState({ draft: null });
    await secureOnboardingStorage.setItem(storageKey, persisted!);
    await useOnboardingDraftStore.persist.rehydrate();
    expect(useOnboardingDraftStore.getState().draft).toMatchObject({
      schemaVersion: 3,
      monthlyBudgetWon: 750_000,
      monthlyBudgetEdited: true
    });
  });

  it("migrates a reviewed legacy null budget as an explicit skip", async () => {
    const now = new Date();
    await secureOnboardingStorage.setItem("wooriai-onboarding-draft", JSON.stringify({
      state: {
        draft: {
          schemaVersion: 2,
          version: 4,
          userId: "legacy-user",
          householdId: "legacy-household",
          selectedPath: "born",
          childName: "봄이",
          dueDate: null,
          birthDate: "2025-05-01",
          manualStage: null,
          stageOverride: false,
          sex: "unknown",
          preparedItemIds: [],
          preparedStepState: "completed_none",
          budget: null,
          currentStep: "review",
          finalSubmitIdempotencyKey: "legacy-final",
          updatedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 60_000).toISOString()
        }
      },
      version: 2
    }));
    await useOnboardingDraftStore.persist.rehydrate();
    expect(useOnboardingDraftStore.getState().draft).toMatchObject({ schemaVersion: 3, monthlyBudgetWon: null, monthlyBudgetEdited: true });
  });

  it("preserves legacy custom and zero amounts while defaulting only an unvisited budget", () => {
    const legacyBase = {
      schemaVersion: 2,
      version: 4,
      userId: "legacy-user",
      householdId: "legacy-household",
      selectedPath: "born",
      childName: "봄이",
      dueDate: null,
      birthDate: "2025-05-01",
      manualStage: null,
      stageOverride: false,
      sex: "unknown",
      preparedItemIds: [],
      preparedStepState: "completed_none",
      currentStep: "budget",
      finalSubmitIdempotencyKey: "legacy-final",
      updatedAt: "2026-07-18T00:00:00.000Z",
      expiresAt: "2026-08-18T00:00:00.000Z"
    };
    expect(sanitizeOnboardingDraft({ ...legacyBase, budget: { yearMonth: "2026-07", amountKrw: 750_000 } }, Date.parse("2026-07-18T00:00:00.000Z"))).toMatchObject({ monthlyBudgetWon: 750_000, monthlyBudgetEdited: true });
    expect(sanitizeOnboardingDraft({ ...legacyBase, budget: { yearMonth: "2026-07", amountKrw: 0 } }, Date.parse("2026-07-18T00:00:00.000Z"))).toMatchObject({ monthlyBudgetWon: 0, monthlyBudgetEdited: true });
    expect(sanitizeOnboardingDraft(legacyBase, Date.parse("2026-07-18T00:00:00.000Z"))).toMatchObject({ monthlyBudgetWon: DEFAULT_MONTHLY_BUDGET_WON, monthlyBudgetEdited: false });
  });

  it("reports a missing scope instead of silently claiming a path selection", () => {
    expect(useOnboardingDraftStore.getState().selectPath("pregnant")).toBe(false);
    expect(useOnboardingDraftStore.getState().draft).toBeNull();
  });

  it("allows selection, change, and cancellation without creating a child", () => {
    const store = useOnboardingDraftStore.getState();
    store.activateScope("user-a", "household-a");
    store.selectPath("pregnant");
    store.updateDraft({ childName: "별이", dueDate: "2026-12-01", sex: "unknown" });
    store.replacePreparedItems(["prepared-for-pregnancy"]);
    const versionBeforeChange = useOnboardingDraftStore.getState().draft!.version;
    store.selectPath("born");

    expect(useOnboardingDraftStore.getState().draft).toMatchObject({
      selectedPath: "born",
      childName: "별이",
      dueDate: null,
      sex: "unknown",
      preparedItemIds: [],
      preparedStepState: "not_started",
      version: versionBeforeChange + 1
    });

    store.selectPath(null);
    expect(useOnboardingDraftStore.getState().draft?.selectedPath).toBeNull();
  });

  it("rejects a stale screen mutation instead of overwriting a newer draft", () => {
    const store = useOnboardingDraftStore.getState();
    store.activateScope("user-a", "household-a");
    const initialVersion = useOnboardingDraftStore.getState().draft!.version;
    store.updateDraft({ childName: "최신 이름" }, initialVersion);
    store.updateDraft({ childName: "오래된 화면 이름" }, initialVersion);

    expect(useOnboardingDraftStore.getState().draft).toMatchObject({
      childName: "최신 이름",
      version: initialVersion + 1
    });
  });

  it("discards an expired or structurally corrupt persisted draft", async () => {
    const storageKey = "wooriai-onboarding-draft";
    await secureOnboardingStorage.setItem(storageKey, JSON.stringify({
      state: {
        draft: {
          schemaVersion: 2,
          version: 4,
          userId: "user-a",
          householdId: "household-a",
          childName: "노출되면 안 되는 이름",
          expiresAt: "2020-01-01T00:00:00.000Z"
        }
      },
      version: 2
    }));
    await useOnboardingDraftStore.persist.rehydrate();
    expect(useOnboardingDraftStore.getState().draft).toBeNull();

    await secureOnboardingStorage.setItem(storageKey, "{not-json");
    await useOnboardingDraftStore.persist.rehydrate();
    expect(useOnboardingDraftStore.getState().draft).toBeNull();
    expect(await secureOnboardingStorage.getItem(storageKey)).toBeNull();

    await secureOnboardingStorage.setItem(storageKey, JSON.stringify({
      state: {
        draft: {
          ...useOnboardingDraftStore.getState().draft,
          schemaVersion: 2,
          version: 3,
          userId: "user-a",
          householdId: "household-a",
          childName: "봄이",
          selectedPath: "fixture_path",
          sex: "unknown",
          preparedItemIds: [],
          preparedStepState: "not_started",
          currentStep: "child-status",
          stageOverride: false,
          finalSubmitIdempotencyKey: "semantic-corrupt",
          updatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString()
        }
      },
      version: 2
    }));
    await useOnboardingDraftStore.persist.rehydrate();
    expect(useOnboardingDraftStore.getState().draft).toBeNull();
  });

  it("does not expose one account's draft after an account switch", () => {
    const store = useOnboardingDraftStore.getState();
    store.activateScope("user-a", "household-a");
    store.updateDraft({ childName: "계정 A 아이" });
    store.activateScope("user-b", "household-b");

    expect(useOnboardingDraftStore.getState().draft).toMatchObject({
      userId: "user-b",
      householdId: "household-b",
      childName: ""
    });
  });

  it("keeps 50 account switches isolated without retaining the previous child draft", () => {
    const store = useOnboardingDraftStore.getState();
    for (let repeat = 0; repeat < 50; repeat += 1) {
      const userId = `user-${repeat}`;
      const householdId = `household-${repeat}`;
      store.activateScope(userId, householdId);
      expect(useOnboardingDraftStore.getState().draft).toMatchObject({ userId, householdId, childName: "" });
      store.updateDraft({ childName: `child-${repeat}` });
    }
  });

  it("is stable across 30 path-change repetitions", () => {
    const store = useOnboardingDraftStore.getState();
    store.activateScope("user-a", "household-a");
    for (let repeat = 0; repeat < 30; repeat += 1) {
      store.selectPath("pregnant");
      store.updateDraft({ dueDate: "2026-12-01" });
      store.selectPath("born");
      expect(useOnboardingDraftStore.getState().draft?.dueDate).toBeNull();
      store.selectPath(null);
    }
  });

  it("restores the scoped draft across 30 simulated app restarts", async () => {
    const storageKey = "wooriai-onboarding-draft";
    const store = useOnboardingDraftStore.getState();
    store.activateScope("restart-user", "restart-household");

    for (let repeat = 0; repeat < 30; repeat += 1) {
      store.updateDraft({ childName: `restart-child-${repeat}`, currentStep: "born" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const persisted = await secureOnboardingStorage.getItem(storageKey);
      expect(persisted).not.toBeNull();

      useOnboardingDraftStore.setState({ draft: null });
      await secureOnboardingStorage.setItem(storageKey, persisted!);
      await useOnboardingDraftStore.persist.rehydrate();
      expect(useOnboardingDraftStore.getState().draft).toMatchObject({
        userId: "restart-user",
        householdId: "restart-household",
        childName: `restart-child-${repeat}`,
        currentStep: "born"
      });
    }
  });
});
