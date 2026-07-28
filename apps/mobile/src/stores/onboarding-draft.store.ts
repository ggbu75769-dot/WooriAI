import {
  DEFAULT_MONTHLY_BUDGET_WON,
  PREPARED_STEP_STATES,
  createEmptyOnboardingDraft,
  normalizeOnboardingPathChange,
  type OnboardingDraft
} from "@wooriai/domain/onboarding";
import { CHILD_STAGE_CODES, CHILD_STAGE_MODES, type ChildStageMode } from "@wooriai/domain/enums";
import { CHILD_SEX_VALUES } from "@wooriai/domain/onboarding";
import { isValidCalendarDate } from "@wooriai/domain/money-date";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { secureOnboardingStorage } from "./secure-onboarding-storage";

const STORE_NAME = "wooriai-onboarding-draft";

type DraftState = {
  draft: OnboardingDraft | null;
  activateScope: (userId: string, householdId: string) => void;
  updateDraft: (patch: Partial<OnboardingDraft>, expectedVersion?: number) => void;
  selectPath: (path: ChildStageMode | null) => boolean;
  replacePreparedItems: (itemIds: string[]) => void;
  resetDraft: () => void;
};

const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ONBOARDING_STEPS = ["child-status", "pregnant", "born", "direct-stage", "prepared-items", "budget", "review"] as const;

function newDraft(userId: string, householdId: string, now = new Date()): OnboardingDraft {
  return createEmptyOnboardingDraft(userId, householdId, {
    nowIso: now.toISOString(),
    expiresAt: new Date(now.getTime() + DRAFT_TTL_MS).toISOString(),
    idempotencyKey: `onboarding-final-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  });
}

type PersistedOnboardingDraft = Omit<Partial<OnboardingDraft>, "schemaVersion" | "monthlyBudgetWon" | "monthlyBudgetEdited"> & {
  schemaVersion?: number;
  budget?: { yearMonth?: unknown; amountKrw?: unknown } | null;
  monthlyBudgetWon?: unknown;
  monthlyBudgetEdited?: unknown;
};

export function sanitizeOnboardingDraft(value: unknown, nowMs = Date.now()): OnboardingDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as PersistedOnboardingDraft;
  if (
    typeof draft.userId !== "string" ||
    typeof draft.householdId !== "string" ||
    typeof draft.updatedAt !== "string" ||
    typeof draft.finalSubmitIdempotencyKey !== "string" ||
    !Array.isArray(draft.preparedItemIds)
  ) return null;
  if (typeof draft.childName !== "string" || draft.childName.length > 60) return null;
  if (draft.selectedPath !== null && !CHILD_STAGE_MODES.includes(draft.selectedPath as never)) return null;
  if (draft.sex !== null && !CHILD_SEX_VALUES.includes(draft.sex as never)) return null;
  if (draft.manualStage !== null && !CHILD_STAGE_CODES.includes(draft.manualStage as never)) return null;
  if (!PREPARED_STEP_STATES.includes(draft.preparedStepState as never)) return null;
  if (!ONBOARDING_STEPS.includes(draft.currentStep as never)) return null;
  if (typeof draft.stageOverride !== "boolean") return null;
  if (draft.preparedItemIds.length > 12 || draft.preparedItemIds.some((id) => typeof id !== "string")) return null;
  if ((draft.preparedStepState === "selected") !== (draft.preparedItemIds.length > 0)) return null;
  if ((draft.preparedStepState === "skipped" || draft.preparedStepState === "completed_none") && draft.preparedItemIds.length > 0) return null;
  if (draft.dueDate !== null && (typeof draft.dueDate !== "string" || !isValidCalendarDate(draft.dueDate))) return null;
  if (draft.birthDate !== null && (typeof draft.birthDate !== "string" || !isValidCalendarDate(draft.birthDate))) return null;
  if (draft.selectedPath === "pregnant" && (draft.birthDate || draft.manualStage || draft.stageOverride)) return null;
  if (draft.selectedPath === "born" && (draft.dueDate || draft.manualStage || draft.stageOverride)) return null;
  if (draft.selectedPath === "manual" && draft.dueDate && draft.birthDate) return null;
  if (draft.selectedPath === null && (draft.dueDate || draft.birthDate || draft.manualStage || draft.stageOverride)) return null;
  let monthlyBudgetWon: number | null;
  let monthlyBudgetEdited: boolean;
  if (draft.schemaVersion === 3) {
    if (typeof draft.monthlyBudgetEdited !== "boolean") return null;
    if (draft.monthlyBudgetWon !== null
      && (!Number.isSafeInteger(draft.monthlyBudgetWon) || Number(draft.monthlyBudgetWon) < 0)) return null;
    monthlyBudgetWon = draft.monthlyBudgetWon === null ? null : Number(draft.monthlyBudgetWon);
    monthlyBudgetEdited = draft.monthlyBudgetEdited;
  } else if (draft.budget && typeof draft.budget === "object") {
    if (!Number.isSafeInteger(draft.budget.amountKrw) || Number(draft.budget.amountKrw) < 0) return null;
    monthlyBudgetWon = Number(draft.budget.amountKrw);
    monthlyBudgetEdited = true;
  } else if (draft.budget === null && draft.currentStep === "review") {
    monthlyBudgetWon = null;
    monthlyBudgetEdited = true;
  } else {
    monthlyBudgetWon = DEFAULT_MONTHLY_BUDGET_WON;
    monthlyBudgetEdited = false;
  }
  const expiresAt = (draft.schemaVersion === 2 || draft.schemaVersion === 3) && typeof draft.expiresAt === "string"
    ? draft.expiresAt
    : new Date(Date.parse(draft.updatedAt) + DRAFT_TTL_MS).toISOString();
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= nowMs) return null;
  const { budget: _legacyBudget, ...draftWithoutLegacyBudget } = draft;
  return {
    ...(draftWithoutLegacyBudget as OnboardingDraft),
    schemaVersion: 3,
    version: Number.isInteger(draft.version) && Number(draft.version) > 0 ? Number(draft.version) : 1,
    monthlyBudgetWon,
    monthlyBudgetEdited,
    expiresAt
  };
}

function isDraftForScope(draft: OnboardingDraft | null, userId: string, householdId: string) {
  return draft?.userId === userId && draft.householdId === householdId;
}

export const useOnboardingDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      draft: null,
      activateScope: (userId, householdId) =>
        set((state) => ({
          draft: isDraftForScope(state.draft, userId, householdId)
            ? state.draft
            : newDraft(userId, householdId)
        })),
      updateDraft: (patch, expectedVersion) =>
        set((state) => ({
          draft: state.draft && (expectedVersion === undefined || state.draft.version === expectedVersion)
            ? {
                ...state.draft,
                ...patch,
                schemaVersion: 3,
                version: state.draft.version + 1,
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + DRAFT_TTL_MS).toISOString()
              }
            : state.draft
        })),
      selectPath: (path) => {
        let updated = false;
        set((state) => {
          if (!state.draft) return state;
          updated = true;
          return { draft: normalizeOnboardingPathChange(state.draft, path, new Date().toISOString()) };
        });
        return updated;
      },
      replacePreparedItems: (itemIds) =>
        set((state) => ({
          draft: state.draft
            ? {
                ...state.draft,
                preparedItemIds: [...new Set(itemIds)],
                preparedStepState: itemIds.length > 0 ? "selected" : "not_started",
                version: state.draft.version + 1,
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + DRAFT_TTL_MS).toISOString()
              }
            : null
        })),
      resetDraft: () => set({ draft: null })
    }),
    {
      name: STORE_NAME,
      storage: createJSONStorage(() => secureOnboardingStorage),
      version: 3,
      partialize: (state) => ({ draft: state.draft }),
      migrate: (persisted) => {
        const draft = persisted && typeof persisted === "object"
          ? sanitizeOnboardingDraft((persisted as { draft?: unknown }).draft)
          : null;
        return { draft } as DraftState;
      },
      merge: (persisted, current) => ({
        ...current,
        draft: persisted && typeof persisted === "object"
          ? sanitizeOnboardingDraft((persisted as { draft?: unknown }).draft)
          : null
      })
    }
  )
);

export async function clearOnboardingDraft(): Promise<void> {
  useOnboardingDraftStore.getState().resetDraft();
  await secureOnboardingStorage.removeItem(STORE_NAME);
}
