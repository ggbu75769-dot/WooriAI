import { create } from "zustand";
import type { OnboardingProgress } from "../api/client";

/**
 * MOB-101: hands the server-fetched onboarding progress off from app/index.tsx (where it is
 * fetched once on cold start / resume) to the ONB-006 resume screen, without re-fetching or
 * threading it through router params. Deliberately not persisted -- it is only valid for the
 * navigation that just fetched it, and a stale value from a previous session must never survive
 * an app restart (the next cold start always re-fetches before reading this).
 */
export type OnboardingResumeState = {
  progress: OnboardingProgress | null;
  setProgress: (progress: OnboardingProgress | null) => void;
};

export const useOnboardingResumeStore = create<OnboardingResumeState>((set) => ({
  progress: null,
  setProgress: (progress) => set({ progress })
}));
