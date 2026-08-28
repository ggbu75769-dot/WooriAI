import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Child, OnboardingProgress } from "../api/client";
import {
  applySelectedChildRecoveryOutcome,
  MULTI_CHILD_RECOVERY_NOTICE,
  recoverSelectedChild,
  selectedChildRecoveryOutcome,
  shouldAttemptSelectedChildRecovery
} from "./selected-child-recovery";
import { useOnboardingProgressStore } from "../stores/onboarding-progress.store";
import { useOnboardingResumeStore } from "../stores/onboarding-resume.store";
import { useSelectedChildStore } from "../stores/selected-child.store";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** R19-C(F1): 복구 소스는 GET /onboarding/status 요약이 아니라 GET /children 목록이다. */
function child(id: string, nickname = "봄이"): Child {
  return {
    id,
    householdId: "household-1",
    nickname,
    stageMode: "born",
    dueDate: null,
    birthDate: "2026-05-01",
    manualStage: null,
    currentStage: "infant_0_3",
    stageLabel: "0~3개월"
  };
}

function childrenList(...children: Child[]): () => Promise<{ children: Child[] }> {
  return async () => ({ children });
}

/** 아직 아이가 없는 계정(로컬 hasReachedHome=true가 낡았던 경우)에 대응하는 서버 진행 상태. */
function progressWithoutChild(): OnboardingProgress {
  return {
    completed: false,
    nextStep: "child-profile",
    canRestart: true,
    summary: { consentsAccepted: true, child: null, preparedItemsCount: null, budget: null }
  };
}

/** The exact stuck state MOB-116 targets: hydrated real session, home reached, child blob lost. */
const stuckRealSession = {
  hydrated: true,
  isTestSession: false,
  accessToken: "real-token",
  hasReachedHome: true,
  selectedChildId: null
};

/** The state app/index.tsx sees right after the no-child recovery reset: home no longer reached,
 * still no selected child, so the MOB-101 progress check is the thing that decides the route. */
const baseAfterReset = { hasReachedHome: false, selectedChildId: null, hasResumeTarget: false };

function storeEffects(notices?: string[]) {
  return {
    setSelectedChildId: useSelectedChildStore.getState().setSelectedChildId,
    resetOnboarding: useOnboardingProgressStore.getState().resetOnboarding,
    notify: (message: string) => notices?.push(message)
  };
}

describe("MOB-116 real-session selectedChildId recovery", () => {
  beforeEach(() => {
    useSelectedChildStore.getState().clearSelectedChildId();
    useOnboardingProgressStore.getState().resetOnboarding();
    useOnboardingResumeStore.getState().setProgress(null);
  });

  describe("shouldAttemptSelectedChildRecovery (decision table)", () => {
    it("fires exactly for a hydrated real session that reached home but lost its selected child", () => {
      expect(shouldAttemptSelectedChildRecovery(stuckRealSession)).toBe(true);
    });

    it("stays quiet whenever any precondition is missing", () => {
      expect(shouldAttemptSelectedChildRecovery({ ...stuckRealSession, hydrated: false })).toBe(false);
      expect(shouldAttemptSelectedChildRecovery({ ...stuckRealSession, accessToken: null })).toBe(false);
      // Never reached home -> the existing MOB-101 onboarding-resume flow owns this case.
      expect(shouldAttemptSelectedChildRecovery({ ...stuckRealSession, hasReachedHome: false })).toBe(false);
      // Nothing was lost -> nothing to recover.
      expect(shouldAttemptSelectedChildRecovery({ ...stuckRealSession, selectedChildId: "child-1" })).toBe(false);
    });
  });

  describe("lost child blob + exactly one child server-side -> unambiguous recovery", () => {
    it("re-derives the child from GET /children and re-selects it, with nothing to announce", async () => {
      const notices: string[] = [];
      const outcome = await recoverSelectedChild("real-token", childrenList(child("child-777")));
      expect(outcome).toEqual({ kind: "recovered", childId: "child-777", ambiguous: false });

      const status = applySelectedChildRecoveryOutcome(outcome, storeEffects(notices));
      expect(status).toBe("recovered");
      expect(useSelectedChildStore.getState().selectedChildId).toBe("child-777");
      expect(notices).toEqual([]);
    });

    it("flips the attempt condition off after recovery, so the /(tabs) redirect proceeds with real data", async () => {
      const outcome = await recoverSelectedChild("real-token", childrenList(child("child-777")));
      applySelectedChildRecoveryOutcome(outcome, storeEffects());
      expect(
        shouldAttemptSelectedChildRecovery({
          ...stuckRealSession,
          selectedChildId: useSelectedChildStore.getState().selectedChildId
        })
      ).toBe(false);
    });
  });

  /**
   * R19-C(F1): 예전 구현은 GET /onboarding/status의 summary.child(=가구의 첫째)만 봤기 때문에
   * 둘째를 쓰던 사용자를 매번 조용히 첫째로 되돌렸다. 목록을 보게 되면 "여러 명"이라는 사실을
   * 알 수 있으므로, 여전히 첫째를 고르되 골라줬다는 사실을 반드시 알린다.
   */
  describe("lost child blob + 다자녀 -> 첫째를 고르되 침묵하지 않는다", () => {
    it("flags the pick as ambiguous and hands the caller the 안내 문구", async () => {
      const notices: string[] = [];
      const outcome = await recoverSelectedChild(
        "real-token",
        childrenList(child("child-1", "첫째"), child("child-2", "둘째"))
      );
      expect(outcome).toEqual({ kind: "recovered", childId: "child-1", ambiguous: true });

      expect(applySelectedChildRecoveryOutcome(outcome, storeEffects(notices))).toBe("recovered");
      expect(useSelectedChildStore.getState().selectedChildId).toBe("child-1");
      expect(notices).toEqual([MULTI_CHILD_RECOVERY_NOTICE]);
      expect(MULTI_CHILD_RECOVERY_NOTICE).toContain("설정 > 아이 관리");
    });

    it("keeps working when the caller passes no notify effect at all", () => {
      const outcome = selectedChildRecoveryOutcome([child("child-1"), child("child-2")]);
      expect(
        applySelectedChildRecoveryOutcome(outcome, {
          setSelectedChildId: useSelectedChildStore.getState().setSelectedChildId,
          resetOnboarding: useOnboardingProgressStore.getState().resetOnboarding
        })
      ).toBe("recovered");
    });

    it("picks the server's first child (createdAt asc), the same one 아이 관리 lists first", () => {
      expect(selectedChildRecoveryOutcome([child("older"), child("newer")])).toEqual({
        kind: "recovered",
        childId: "older",
        ambiguous: true
      });
    });
  });

  describe("lost child blob + zero children server-side -> back to onboarding", () => {
    it("resets local onboarding progress (the stale hasReachedHome=true) instead of selecting anything", async () => {
      useOnboardingProgressStore.getState().markHomeReached();

      const outcome = await recoverSelectedChild("real-token", childrenList());
      expect(outcome).toEqual({ kind: "no-child" });

      const status = applySelectedChildRecoveryOutcome(outcome, storeEffects());
      expect(status).toBe("no-child");
      expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
      // hasReachedHome cleared -> app/index.tsx's default routing walks the ordinary
      // MOB-101 onboarding flow (server progress check -> resume screen or ONB-001).
      expect(useOnboardingProgressStore.getState().hasReachedHome).toBe(false);
      expect(
        shouldAttemptSelectedChildRecovery({ ...stuckRealSession, hasReachedHome: false })
      ).toBe(false);
    });
  });

  describe("FIX-118A (m-9): the no-child recovery must land on ONB-006 이어하기, not skip it", () => {
    /**
     * Models app/index.tsx's routing decision for a real, hydrated session, so the interaction
     * between the recovery outcome and the MOB-101 progress check is testable without a React
     * renderer (the screen itself is not runtime-testable under vitest -- ui-wiring.test.ts
     * convention). `progressFetch` is exactly the screen's state machine: it starts "idle" and
     * only leaves that value in an effect, i.e. one commit AFTER the render that observes it.
     */
    function routeForRealSession(input: {
      hasReachedHome: boolean;
      selectedChildId: string | null;
      progressFetch: "idle" | "loading" | "done";
      hasResumeTarget: boolean;
    }): "hold" | "resume" | "child-status" | "tabs" {
      if (shouldAttemptSelectedChildRecovery({ ...stuckRealSession, ...input })) {
        return "hold";
      }
      if (!input.hasReachedHome) {
        if (input.progressFetch !== "done") return "hold";
        if (input.hasResumeTarget) return "resume";
      }
      return input.hasReachedHome ? "tabs" : "child-status";
    }

    it("holds the redirect on the first render after resetOnboarding, instead of jumping to ONB-001", async () => {
      useOnboardingProgressStore.getState().markHomeReached();
      const outcome = await recoverSelectedChild("real-token", childrenList());
      expect(applySelectedChildRecoveryOutcome(outcome, storeEffects())).toBe("no-child");

      // The very next render: hasReachedHome is now false, but the progress-check effect has not
      // run yet, so progressFetch is still "idle". Before the fix this fell through to
      // /onboarding/child-status and the resume screen was never reachable.
      expect(
        routeForRealSession({
          hasReachedHome: useOnboardingProgressStore.getState().hasReachedHome,
          selectedChildId: useSelectedChildStore.getState().selectedChildId,
          progressFetch: "idle",
          hasResumeTarget: false
        })
      ).toBe("hold");
    });

    it("routes to the ONB-006 resume screen once the progress check answers with real progress", async () => {
      useOnboardingProgressStore.getState().markHomeReached();
      const progress = progressWithoutChild();
      expect(progress.summary.consentsAccepted).toBe(true);
      applySelectedChildRecoveryOutcome(
        await recoverSelectedChild("real-token", childrenList()),
        storeEffects()
      );

      // ...the held render lets app/index.tsx's MOB-101 effect run: it fetches progress and,
      // because consents were already accepted, hands it to the resume store.
      expect(routeForRealSession({ ...baseAfterReset, progressFetch: "loading" })).toBe("hold");
      useOnboardingResumeStore.getState().setProgress(progress);
      expect(routeForRealSession({ ...baseAfterReset, progressFetch: "done", hasResumeTarget: true })).toBe("resume");
      expect(useOnboardingResumeStore.getState().progress).toBe(progress);
    });

    it("still falls back to ONB-001 for a genuinely fresh account (no resume-worthy progress)", () => {
      expect(routeForRealSession({ ...baseAfterReset, progressFetch: "done" })).toBe("child-status");
    });

    it("app/index.tsx holds the redirect for BOTH pending progress states (source verification)", () => {
      const indexSource = source("app/index.tsx");
      // 라운드 51 #2: 조건에 `progressToken &&`가 앞에 붙었다 -- 토큰이 없으면 조회가 돌지
      // 않으므로 기다릴 대상도 없다(빈 화면으로 굳지 않기 위한 안전장치). "idle도 함께
      // 잡아둔다"는 FIX-118A 계약 자체는 그대로다.
      expect(indexSource).toContain('progressFetch !== "done"');
      expect(indexSource).not.toContain('if (progressFetch === "loading") {\n      return null;');
    });
  });

  describe("offline / server failure -> retryable error, never an unhandled rejection", () => {
    it("maps a rejected fetch to a plain error outcome and leaves every store untouched", async () => {
      useOnboardingProgressStore.getState().markHomeReached();

      const outcome = await recoverSelectedChild("real-token", async () => {
        throw new Error("Network request failed");
      });
      expect(outcome).toEqual({ kind: "error" });

      const status = applySelectedChildRecoveryOutcome(outcome, storeEffects());
      expect(status).toBe("error");
      expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
      expect(useOnboardingProgressStore.getState().hasReachedHome).toBe(true);
      // Preconditions intact -> a retry attempt is still possible (the hook's retry() re-arms
      // the same shouldAttempt condition).
      expect(shouldAttemptSelectedChildRecovery(stuckRealSession)).toBe(true);
    });

    it("recovers on a retry once the network is back", async () => {
      const responses = [
        () => Promise.reject<{ children: Child[] }>(new Error("offline")),
        () => Promise.resolve({ children: [child("child-42")] })
      ];
      const flakyFetch = () => responses.shift()!();

      expect(await recoverSelectedChild("real-token", flakyFetch)).toEqual({ kind: "error" });
      const second = await recoverSelectedChild("real-token", flakyFetch);
      expect(second).toEqual({ kind: "recovered", childId: "child-42", ambiguous: false });
    });
  });

  describe("test session behavior stays exactly MOB-107", () => {
    it("never attempts server recovery for a test session, even in the lost-child state", () => {
      expect(
        shouldAttemptSelectedChildRecovery({
          ...stuckRealSession,
          isTestSession: true,
          accessToken: null
        })
      ).toBe(false);
      expect(
        shouldAttemptSelectedChildRecovery({ ...stuckRealSession, isTestSession: true })
      ).toBe(false);
    });

    /**
      * 실기기 피드백 1: MOB-107의 목적(테스트 세션의 selectedChildId가 비어 굳는 것을 막는다)은
      * 그대로지만, 근거가 "고정 데모 아이 id"에서 "로컬 백엔드에 실제로 있는 아이"로 바뀌었다 --
      * 테스트 로그인도 데이터 0에서 시작하므로 고정 id의 아이는 더 이상 존재하지 않는다.
      */
    it("keeps the MOB-107 self-healing path in app/index.tsx, now keyed on the real local child", () => {
      const indexSource = source("app/index.tsx");
      expect(indexSource).toContain("if (!hydrated || !isTestSession)");
      expect(indexSource).toContain("const childId = localChildId();");
      expect(indexSource).toContain("if (!selectedChildId) setSelectedChildId(childId);");
      // 아이가 없으면(온보딩 미완료) 남은 선택·완료 표시를 지워 온보딩으로 되돌린다.
      expect(indexSource).toContain("if (selectedChildId) clearSelectedChildId();");
      expect(indexSource).toContain("if (hasReachedHome) resetOnboarding();");
      expect(indexSource).not.toContain("setSelectedChildId(LOCAL_CHILD_ID);");
    });
  });

  describe("wired-up source contract (ui-wiring.test.ts convention -- the hook itself is not runtime-testable under vitest)", () => {
    it("mounts the recovery hook in app/index.tsx and holds the /(tabs) redirect while recovery is pending", () => {
      const indexSource = source("app/index.tsx");
      expect(indexSource).toContain("useSelectedChildRecovery(childRecoveryInput, { setSelectedChildId, resetOnboarding })");
      expect(indexSource).toContain("if (shouldAttemptSelectedChildRecovery(childRecoveryInput))");
      // The already-onboarded fast path pinned by test-login-flow.test.ts must survive
      // (실기기 피드백 1: 데모 세션 예외 `|| isTestSession`이 빠졌다).
      expect(indexSource).toContain('hasReachedHome ? "/(tabs)" : "/onboarding/child-status"');
    });

    it("renders the standard retry affordance on failure instead of an infinite spinner", () => {
      const indexSource = source("app/index.tsx");
      expect(indexSource).toContain('testID="screen-child-recovery-error"');
      expect(indexSource).toContain("아이 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      expect(indexSource).toContain('<SecondaryButton label="다시 시도" onPress={childRecovery.retry} />');
    });

    it("bounds the in-flight state with the same 3s valve convention as the other index.tsx checks", () => {
      const recoverySource = source("src/onboarding/selected-child-recovery.ts");
      expect(recoverySource).toContain("SELECTED_CHILD_RECOVERY_TIMEOUT_MS = 3000");
      expect(recoverySource).toContain('setStatus("error");');
    });

    it("R19-C(F1): recovers from GET /children, not the first-child-only status summary", () => {
      const recoverySource = source("src/onboarding/selected-child-recovery.ts");
      expect(recoverySource).toContain('import { listChildren, type Child } from "../api/client";');
      expect(recoverySource).not.toContain("getOnboardingProgress");
    });

    it("R19-C(F1): app/index.tsx surfaces the 다자녀 안내 before continuing to /(tabs)", () => {
      const indexSource = source("app/index.tsx");
      expect(indexSource).toContain('testID="screen-child-recovery-notice"');
      expect(indexSource).toContain("if (childRecovery.notice && !recoveryNoticeAcknowledged)");
      expect(indexSource).toContain("<Toast message={childRecovery.notice} />");
      expect(indexSource).toContain("setRecoveryNoticeAcknowledged(true)");
    });

    it("R19-C(F1): the MOB-101 progress check asks about the selected child when there is one", () => {
      // FIX-119B/F5: 호출이 얇은 래퍼(fetchOnboardingProgressForSelectedChild)로 옮겨졌다 --
      // 아이 스코프 질의라는 R19-C(F1) 계약은 그 래퍼 안에서 그대로 유지된다.
      const indexSource = source("app/index.tsx");
      // 라운드 51 #2: 첫 인자가 progressToken(실토큰 ?? 데모 토큰)으로 바뀌었을 뿐,
      // 두 번째 인자로 아이 스코프를 넘기는 계약은 그대로다.
      expect(indexSource).toContain("fetchOnboardingProgressForSelectedChild(progressToken, selectedChildId)");
      const scopeSource = source("src/onboarding/onboarding-progress-scope.ts");
      expect(scopeSource).toContain("fetchProgress(token, selectedChildId)");
    });
  });
});
