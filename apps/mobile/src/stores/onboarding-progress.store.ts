import type { ChildStageCode, ChildStageMode } from "@wooriai/domain";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { OnboardingScreenId } from "../onboarding/steps";
import { zustandPersistStorage } from "./persist-storage";

export type OnboardingProgressState = {
  completedStepIds: OnboardingScreenId[];
  hasReachedHome: boolean;
  childDraft: {
    stageMode: ChildStageMode | null;
    nickname: string;
    dueDate: string;
    birthDate: string;
    manualStage: ChildStageCode | null;
  };
  /**
   * MOB-101 (round5a-sprint1-plan.md §4): stable Idempotency-Key reused across retries of the
   * *same* child-profile submission (app restart / lost response mid-request), so createChild
   * can safely be resubmitted without the server creating a second child for the household. Set
   * lazily by getOrCreateChildCreateIdempotencyKey and cleared once the submission succeeds (or
   * onboarding restarts), so a later, genuinely new child creation gets a fresh key.
   */
  childCreateIdempotencyKey: string | null;
  completeStep: (screenId: OnboardingScreenId) => void;
  markHomeReached: () => void;
  updateChildDraft: (draft: Partial<OnboardingProgressState["childDraft"]>) => void;
  getOrCreateChildCreateIdempotencyKey: () => string;
  clearChildCreateIdempotencyKey: () => void;
  resetOnboarding: () => void;
};

const initialDraft: OnboardingProgressState["childDraft"] = {
  stageMode: null,
  nickname: "",
  dueDate: "",
  birthDate: "",
  manualStage: null
};

/**
 * Not cryptographically random -- the interceptor only needs the key to be stable across
 * retries of one submission and distinct across separate ones, which Date.now() plus a random
 * suffix already guarantees for this single-device, single-submission use.
 */
function generateIdempotencyKey(): string {
  return `onb-child-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type OnboardingProgressData = Pick<
  OnboardingProgressState,
  "completedStepIds" | "hasReachedHome" | "childDraft" | "childCreateIdempotencyKey"
>;

const initialOnboardingData: OnboardingProgressData = {
  completedStepIds: [],
  hasReachedHome: false,
  childDraft: initialDraft,
  childCreateIdempotencyKey: null
};

/**
 * MOB-107: defensive shape check for a persisted blob from an older app version. `childDraft`
 * gained fields over time and `childCreateIdempotencyKey` didn't exist before Sprint1 -- rather
 * than trust whatever shape is on disk, validate the fields this version actually reads/writes
 * and fall back to safe defaults per-field so one corrupt/missing field can't crash the whole
 * onboarding flow (e.g. `completeStep`'s `.includes` call on a non-array).
 */
function sanitizeOnboardingProgress(persisted: unknown): OnboardingProgressData {
  if (!persisted || typeof persisted !== "object") return initialOnboardingData;
  const candidate = persisted as Partial<OnboardingProgressData>;
  const completedStepIds = Array.isArray(candidate.completedStepIds)
    ? candidate.completedStepIds.filter((id): id is OnboardingScreenId => typeof id === "string")
    : initialOnboardingData.completedStepIds;
  const hasReachedHome = typeof candidate.hasReachedHome === "boolean" ? candidate.hasReachedHome : false;
  const childDraft =
    candidate.childDraft && typeof candidate.childDraft === "object"
      ? { ...initialDraft, ...candidate.childDraft }
      : initialDraft;
  const childCreateIdempotencyKey =
    typeof candidate.childCreateIdempotencyKey === "string" ? candidate.childCreateIdempotencyKey : null;
  return { completedStepIds, hasReachedHome, childDraft, childCreateIdempotencyKey };
}

export const useOnboardingProgressStore = create<OnboardingProgressState>()(
  persist(
    (set, get) => ({
      completedStepIds: [],
      hasReachedHome: false,
      childDraft: initialDraft,
      childCreateIdempotencyKey: null,
      completeStep: (screenId) =>
        set((state) => ({
          completedStepIds: state.completedStepIds.includes(screenId)
            ? state.completedStepIds
            : [...state.completedStepIds, screenId]
        })),
      markHomeReached: () => set({ hasReachedHome: true }),
      updateChildDraft: (draft) =>
        set((state) => ({ childDraft: { ...state.childDraft, ...draft } })),
      getOrCreateChildCreateIdempotencyKey: () => {
        const existing = get().childCreateIdempotencyKey;
        if (existing) return existing;
        const key = generateIdempotencyKey();
        set({ childCreateIdempotencyKey: key });
        return key;
      },
      clearChildCreateIdempotencyKey: () => set({ childCreateIdempotencyKey: null }),
      resetOnboarding: () =>
        set({ completedStepIds: [], hasReachedHome: false, childDraft: initialDraft, childCreateIdempotencyKey: null })
    }),
    {
      name: "wooriai-onboarding-progress",
      storage: createJSONStorage(() => zustandPersistStorage),
      // MOB-107: bumped for the childCreateIdempotencyKey field (Sprint1/MOB-101) so `migrate`
      // runs against anything written before it existed (round4 and earlier).
      version: 1,
      migrate: (persisted) => sanitizeOnboardingProgress(persisted),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeOnboardingProgress(persisted)
      })
    }
  )
);
