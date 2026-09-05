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
  /**
   * MOB-101 (round5a-sprint1-plan.md §4): stable Idempotency-Key reused across retries of the
   * *same* child-profile submission (app restart / lost response mid-request), so createChild
   * can safely be resubmitted without the server creating a second child for the household. Set
   * lazily by getOrCreateChildCreateIdempotencyKey and cleared once the submission succeeds (or
   * onboarding restarts), so a later, genuinely new child creation gets a fresh key.
   */
  childCreateIdempotencyKey: string | null;
  /**
   * 라운드 99 트랙 F1(M) — 위 키를 발급받은 **제출 본문의 정규화 지문**(⚠️ 두 시점: 종전에는
   * 이 필드가 없었다 — "같은 제출"의 판정이 없어서, 응답을 잃은 뒤 입력을 **고쳐** 재제출해도
   * 같은 키가 나갔고, 서버 멱등 인터셉터의 같은 키 + 다른 본문 409(IDEMPOTENCY_KEY_CONFLICT,
   * 24h)에 갇혔다). 키와 지문은 언제나 함께 서고 함께 지워진다 — 본문이 달라지면
   * getOrCreateChildCreateIdempotencyKey가 새 키를 발급한다(멱등 보호는 동일 본문 재시도에만).
   */
  childCreateIdempotencyBodyHash: string | null;
  completeStep: (screenId: OnboardingScreenId) => void;
  markHomeReached: () => void;
  updateChildDraft: (draft: Partial<OnboardingProgressState["childDraft"]>) => void;
  getOrCreateChildCreateIdempotencyKey: (bodyHash: string) => string;
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
  "completedStepIds" | "hasReachedHome" | "childDraft" | "childCreateIdempotencyKey" | "childCreateIdempotencyBodyHash"
>;

const initialOnboardingData: OnboardingProgressData = {
  completedStepIds: [],
  hasReachedHome: false,
  childDraft: initialDraft,
  childCreateIdempotencyKey: null,
  childCreateIdempotencyBodyHash: null
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
  // 라운드 99 트랙 F1(M): 지문 필드가 없던 옛 blob은 null로 온다 — 그 키가 어느 본문의
  // 것인지 모르므로 getOrCreateChildCreateIdempotencyKey의 지문 비교가 어긋나 새 키가
  // 발급된다(모르는 본문에 옛 키를 재사용하는 쪽이 409 루프였다 — 안전한 쪽으로 떨어진다).
  const childCreateIdempotencyBodyHash =
    typeof candidate.childCreateIdempotencyBodyHash === "string" ? candidate.childCreateIdempotencyBodyHash : null;
  return { completedStepIds, hasReachedHome, childDraft, childCreateIdempotencyKey, childCreateIdempotencyBodyHash };
}

export const useOnboardingProgressStore = create<OnboardingProgressState>()(
  persist(
    (set, get) => ({
      completedStepIds: [],
      hasReachedHome: false,
      childDraft: initialDraft,
      childCreateIdempotencyKey: null,
      childCreateIdempotencyBodyHash: null,
      completeStep: (screenId) =>
        set((state) => ({
          completedStepIds: state.completedStepIds.includes(screenId)
            ? state.completedStepIds
            : [...state.completedStepIds, screenId]
        })),
      markHomeReached: () => set({ hasReachedHome: true }),
      updateChildDraft: (draft) =>
        set((state) => ({ childDraft: { ...state.childDraft, ...draft } })),
      // 라운드 99 트랙 F1(M) — ⚠️ 두 시점: 종전에는 인자가 없었고 "키가 있으면 무조건 재사용"
      // 이었다. 이제 본문 지문이 같을 때만 재사용한다(다른 본문에 옛 키를 재사용하면 서버가
      // 409 IDEMPOTENCY_KEY_CONFLICT를 24시간 돌려줘 — idempotency.interceptor.ts — 입력을
      // 고친 재제출이 무한 루프였다). 지문 계산은 설정 아이 추가와 같은 한 벌이다
      // (src/children/child-create-idempotency.ts의 childCreateBodyFingerprint).
      getOrCreateChildCreateIdempotencyKey: (bodyHash) => {
        const { childCreateIdempotencyKey: existing, childCreateIdempotencyBodyHash: existingHash } = get();
        if (existing && existingHash === bodyHash) return existing;
        const key = generateIdempotencyKey();
        set({ childCreateIdempotencyKey: key, childCreateIdempotencyBodyHash: bodyHash });
        return key;
      },
      clearChildCreateIdempotencyKey: () =>
        set({ childCreateIdempotencyKey: null, childCreateIdempotencyBodyHash: null }),
      resetOnboarding: () =>
        set({
          completedStepIds: [],
          hasReachedHome: false,
          childDraft: initialDraft,
          childCreateIdempotencyKey: null,
          childCreateIdempotencyBodyHash: null
        })
    }),
    {
      name: "wooriai-onboarding-progress",
      storage: createJSONStorage(() => persistStorage),
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
