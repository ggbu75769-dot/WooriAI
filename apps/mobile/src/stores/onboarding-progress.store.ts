import type { ChildStageCode, ChildStageMode } from "@wooriai/domain";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { OnboardingScreenId } from "../onboarding/steps";
import { persistStorage } from "./persist-storage";

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
  completeStep: (screenId: OnboardingScreenId) => void;
  markHomeReached: () => void;
  updateChildDraft: (draft: Partial<OnboardingProgressState["childDraft"]>) => void;
  resetOnboarding: () => void;
};

const initialDraft: OnboardingProgressState["childDraft"] = {
  stageMode: null,
  nickname: "",
  dueDate: "",
  birthDate: "",
  manualStage: null
};

export const useOnboardingProgressStore = create<OnboardingProgressState>()(
  persist(
    (set) => ({
      completedStepIds: [],
      hasReachedHome: false,
      childDraft: initialDraft,
      completeStep: (screenId) =>
        set((state) => ({
          completedStepIds: state.completedStepIds.includes(screenId)
            ? state.completedStepIds
            : [...state.completedStepIds, screenId]
        })),
      markHomeReached: () => set({ hasReachedHome: true }),
      updateChildDraft: (draft) =>
        set((state) => ({ childDraft: { ...state.childDraft, ...draft } })),
      resetOnboarding: () =>
        set({ completedStepIds: [], hasReachedHome: false, childDraft: initialDraft })
    }),
    {
      name: "wooriai-onboarding-progress",
      storage: createJSONStorage(() => persistStorage)
    }
  )
);
