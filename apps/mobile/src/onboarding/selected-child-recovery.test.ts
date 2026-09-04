import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Child, OnboardingProgress } from "../api/client";
import {
  applySelectedChildRecoveryOutcome,
  MULTI_CHILD_RECOVERY_NOTICE,
  recoverSelectedChild,
  resolveSelectedChildRecoveryErrorCopy,
  SELECTED_CHILD_RECOVERY_DATA_INTACT_NOTICE,
  SELECTED_CHILD_RECOVERY_ERROR_NOTICE,
  SELECTED_CHILD_RECOVERY_WAKE_UNKNOWN,
  selectedChildRecoveryOutcome,
  shouldAttemptSelectedChildRecovery,
  shouldAutoRetrySelectedChildRecovery,
  type SelectedChildRecoveryWake
} from "./selected-child-recovery";
import { OFFLINE_RETRY_NOTICE } from "../offline/messages";
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
      // 두 시점(라운드 96 T5): 종전 표기는 경로 기호("설정 > 아이 관리")였다 — 자연어로 풀었다.
      expect(MULTI_CHILD_RECOVERY_NOTICE).toContain("설정의 아이 관리");
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
      // 라운드 51 QA(P3-11): 앵커를 조건문 전체로 되돌린다. `progressFetch !== "done"` 조각만
      // 보면 이 화면 어디에나 있을 수 있는 문자열이라(예: 다른 갈래의 방어 조건) 정작 지켜야 할
      // "토큰이 있을 때 두 대기 상태를 함께 붙잡는다"는 계약이 깨져도 통과한다.
      // 라운드 52 QA(P3-4): 그 조건식은 이제 홀딩 판정 함수의 **인자**로 그대로 옮겨 갔다
      // (판정표가 화면과 모듈에 두 벌이던 것을 한 벌로 모았다 -- cold-start-hold.test.ts).
      // 계약은 한 글자도 바뀌지 않았다: 토큰이 있을 때 "idle"과 "loading"을 함께 붙잡는다.
      expect(indexSource).toContain(
        'onboardingProgressPending: !hasReachedHome && Boolean(progressToken) && progressFetch !== "done"'
      );
      expect(indexSource).toContain('if (holdReason === "onboarding-progress") {');
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
      // 라운드 71 트랙 C: 세 번째 인자(네이티브 배선)가 붙었을 뿐 마운트 계약은 그대로다.
      expect(indexSource).toContain("useSelectedChildRecovery(");
      expect(indexSource).toContain("childRecoveryInput,\n    { setSelectedChildId, resetOnboarding },");
      // QA P3-4: 판정식은 그대로이고, 이름이 붙어 홀딩 판정의 인자가 됐다.
      expect(indexSource).toContain("const childRecoveryNeeded = shouldAttemptSelectedChildRecovery(childRecoveryInput);");
      expect(indexSource).toContain('childRecoveryPending: childRecoveryNeeded && childRecovery.status !== "error",');
      // The already-onboarded fast path pinned by test-login-flow.test.ts must survive
      // (실기기 피드백 1: 데모 세션 예외 `|| isTestSession`이 빠졌다).
      expect(indexSource).toContain('hasReachedHome ? "/(tabs)" : "/onboarding/child-status"');
    });

    it("renders the standard retry affordance on failure instead of an infinite spinner", () => {
      const indexSource = source("app/index.tsx");
      expect(indexSource).toContain('testID="screen-child-recovery-error"');
      // 라운드 71 트랙 C: 문장은 판정에서 오고(리터럴이 화면에 남지 않는다), 버튼은 그대로다.
      expect(indexSource).toContain("{childRecovery.copy.title}");
      expect(indexSource).toContain("{childRecovery.copy.body}");
      expect(indexSource).not.toContain("아이 정보를 불러오지 못했어요");
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

  /* ------------------------------------------------------------------------------------ */
  /* 라운드 71 트랙 C(#3) — 현관에서 막힌 사람에게 앱이 하는 말과 하는 일                    */
  /* ------------------------------------------------------------------------------------ */

  /**
   * 회귀 고정은 **네 좌표**다: 오프라인 실패 → 문구가 갈린다 · 재연결/포그라운드 복귀 →
   * 자동 1회 재시도 · 성공 → 종전과 같은 착지 · `no-child` → 종전 그대로. 뒤의 둘은 이 파일의
   * 앞 describe들이 이미 고정하고 있으므로(값이 한 글자도 바뀌지 않았다는 것이 요점이다) 여기서는
   * **바뀐 것**과 **약속이 참이라는 사실**을 못박는다.
   */
  describe("라운드 71 C: 오프라인 실패면 문구가 사실을 갈라 말한다", () => {
    it("연결이 확인된(또는 알 수 없는) 실패는 종전 문장 그대로다", () => {
      expect(SELECTED_CHILD_RECOVERY_ERROR_NOTICE).toBe("아이 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      expect(resolveSelectedChildRecoveryErrorCopy({ isOnline: true }).title).toBe(
        SELECTED_CHILD_RECOVERY_ERROR_NOTICE
      );
    });

    it("오프라인으로 확인된 실패는 그 사실을 말하고, 문장은 기존 단일 소스에서 온다", () => {
      const copy = resolveSelectedChildRecoveryErrorCopy({ isOnline: false });
      expect(copy.title).toBe(OFFLINE_RETRY_NOTICE);
      expect(copy.title).not.toBe(SELECTED_CHILD_RECOVERY_ERROR_NOTICE);
      // 새 문구를 짓지 않았다는 것 자체가 계약이다(src/offline/messages.ts를 읽기만 한다).
      const recoverySource = source("src/onboarding/selected-child-recovery.ts");
      expect(recoverySource).toContain('import { OFFLINE_RETRY_NOTICE } from "../offline/messages";');
    });

    it("두 갈래 모두 '잃지 않은 것'을 같은 한 줄로 말한다 (해요체·건수 주장 없음)", () => {
      for (const isOnline of [true, false]) {
        expect(resolveSelectedChildRecoveryErrorCopy({ isOnline }).body).toBe(
          SELECTED_CHILD_RECOVERY_DATA_INTACT_NOTICE
        );
      }
      expect(SELECTED_CHILD_RECOVERY_DATA_INTACT_NOTICE).toBe("이 기기에 저장한 기록은 그대로 있어요.");
      expect(SELECTED_CHILD_RECOVERY_DATA_INTACT_NOTICE.endsWith("있어요.")).toBe(true);
      expect(SELECTED_CHILD_RECOVERY_DATA_INTACT_NOTICE).not.toMatch(/\d/);
    });

    /**
     * 약속을 하면 지켜야 한다. 이 갈래가 실제로 아무것도 건드리지 않는다는 사실을 **동작으로**
     * 확인하고(스토어 무변경), 앞으로도 그렇게 남도록 **파생 단언**을 함께 둔다 -- 이 모듈이
     * 세션·아웃박스를 지우는 함수를 부르게 되면 그 문장이 거짓이 되므로 여기서 빨개진다.
     */
    it("문장이 약속한 대로 error 갈래는 세션·아웃박스·진행도를 한 줄도 건드리지 않는다", () => {
      useOnboardingProgressStore.getState().markHomeReached();
      useSelectedChildStore.getState().setSelectedChildId("child-9");

      expect(applySelectedChildRecoveryOutcome({ kind: "error" }, storeEffects())).toBe("error");
      expect(useSelectedChildStore.getState().selectedChildId).toBe("child-9");
      expect(useOnboardingProgressStore.getState().hasReachedHome).toBe(true);

      const recoverySource = source("src/onboarding/selected-child-recovery.ts");
      for (const forbidden of [
        "clearSession",
        "wipeOfflineStore",
        "useSessionStore",
        "clearSelectedChildId",
        "getOfflineStore",
        "localChildId"
      ]) {
        expect(recoverySource).not.toContain(forbidden);
      }
    });
  });

  describe("라운드 71 C: 재연결·포그라운드 복귀에 스스로 한 번 다시 시도한다", () => {
    const errorState = { status: "error" as const, shouldAttempt: true };
    const wake = (partial: Partial<SelectedChildRecoveryWake>): SelectedChildRecoveryWake => ({
      ...SELECTED_CHILD_RECOVERY_WAKE_UNKNOWN,
      ...partial
    });

    it("background→active 전이에서 발화한다", () => {
      expect(
        shouldAutoRetrySelectedChildRecovery({
          ...errorState,
          previous: wake({ appState: "background" }),
          next: wake({ appState: "active" })
        })
      ).toBe(true);
      // 구독 직후 처음 받는 "active"도 실제 전이다(AppState는 값이 바뀔 때만 발화한다).
      expect(
        shouldAutoRetrySelectedChildRecovery({
          ...errorState,
          previous: SELECTED_CHILD_RECOVERY_WAKE_UNKNOWN,
          next: wake({ appState: "active" })
        })
      ).toBe(true);
    });

    it("재연결(offline→online) 전이에서 발화한다", () => {
      expect(
        shouldAutoRetrySelectedChildRecovery({
          ...errorState,
          previous: wake({ isOnline: false }),
          next: wake({ isOnline: true })
        })
      ).toBe(true);
    });

    /** 루프 금지: **같은 상태**가 다시 관측되는 것은 전이가 아니다. */
    it("같은 상태가 반복 관측되면 발화하지 않는다", () => {
      const repeats: Array<[SelectedChildRecoveryWake, SelectedChildRecoveryWake]> = [
        [wake({ appState: "active" }), wake({ appState: "active" })],
        [wake({ isOnline: false }), wake({ isOnline: false })],
        [wake({ isOnline: true }), wake({ isOnline: true })],
        [SELECTED_CHILD_RECOVERY_WAKE_UNKNOWN, SELECTED_CHILD_RECOVERY_WAKE_UNKNOWN],
        // 오프라인인 채로 앱만 내려갔다 오는 것은 "재연결"이 아니다(포그라운드 전이도 아니다).
        [wake({ appState: "active", isOnline: false }), wake({ appState: "background", isOnline: false })]
      ];
      for (const [previous, next] of repeats) {
        expect(shouldAutoRetrySelectedChildRecovery({ ...errorState, previous, next })).toBe(false);
      }
    });

    it("실패 카드가 서 있지 않으면(복구 중·성공·복구 불필요) 어떤 전이도 발화하지 않는다", () => {
      const transition = {
        previous: wake({ appState: "background", isOnline: false }),
        next: wake({ appState: "active", isOnline: true })
      };
      for (const status of ["idle", "loading", "recovered", "no-child"] as const) {
        expect(shouldAutoRetrySelectedChildRecovery({ status, shouldAttempt: true, ...transition })).toBe(false);
      }
      // MOB-116 조건이 이미 꺼진 상태(아이를 되찾았거나 온보딩으로 돌아갔다)에서도 마찬가지다.
      expect(
        shouldAutoRetrySelectedChildRecovery({ status: "error", shouldAttempt: false, ...transition })
      ).toBe(false);
    });
  });

  describe("라운드 71 C 배선 (source verification)", () => {
    const recoverySource = () => source("src/onboarding/selected-child-recovery.ts");

    it("화면이 저장소의 기존 연결 배선을 그대로 주입한다(새 구독을 만들지 않는다)", () => {
      const indexSource = source("app/index.tsx");
      expect(indexSource).toContain(
        'import { isCurrentlyOnline, subscribeAppStateChange } from "../src/offline/connectivity";'
      );
      expect(indexSource).toContain("{ isCurrentlyOnline, subscribeAppStateChange }");
      // 네이티브 구독은 connectivity.ts 한 곳이라는 FIX-118A 관례 그대로 -- 화면도 훅도
      // AppState를 직접 구독하지 않는다.
      expect(indexSource).not.toContain("AppState.addEventListener");
      expect(recoverySource()).not.toContain("AppState.addEventListener");
    });

    /**
     * ⚠️ 이 트랙의 금지 사항을 값으로 못박는다: **새 타이머·새 폴러 0건**. 이 모듈의 `setTimeout`은
     * 3초 밸브 하나뿐이고(그 값도 그대로다), `setInterval`은 어디에도 없다 -- 재연결 감시자
     * (`startConnectivityWatcher`)는 아웃박스 flush의 소유물이라 여기서 한 벌 더 켜지 않는다.
     */
    it("새 타이머·새 폴러가 0건이다 (3초 밸브 하나만 남는다)", () => {
      const module = recoverySource();
      expect(module.match(/setTimeout\(/g) ?? []).toHaveLength(1);
      expect(module).toContain("SELECTED_CHILD_RECOVERY_TIMEOUT_MS = 3000");
      // 호출부만 본다(주석에서 이름을 부르는 것은 금지가 아니다 -- 왜 켜지 않았는지가 근거다).
      for (const banned of ["setInterval(", "startConnectivityWatcher("]) {
        expect(module).not.toContain(banned);
        expect(source("app/index.tsx")).not.toContain(banned);
      }
    });

    it("훅은 얇게 남고 판정은 두 순수 함수가 한다", () => {
      const module = recoverySource();
      expect(module).toContain("export function resolveSelectedChildRecoveryErrorCopy(");
      expect(module).toContain("export function shouldAutoRetrySelectedChildRecovery(");
      // 훅 본문은 관측만 하고 판정을 다시 적지 않는다.
      const hookBody = module.slice(module.indexOf("export function useSelectedChildRecovery("));
      expect(hookBody).toContain("shouldAutoRetrySelectedChildRecovery({");
      expect(hookBody).toContain("resolveSelectedChildRecoveryErrorCopy({ isOnline })");
      expect(hookBody).not.toContain('appState === "active"');
    });

    it("탭 셸 통과·로컬 유추라는 두 유혹을 코드가 택하지 않았다 (MOB-116 · R19-C(F1))", () => {
      const indexSource = source("app/index.tsx");
      // 실패 카드는 여전히 리다이렉트 **앞**에 선다(childId 없이 탭으로 보내지 않는다).
      expect(indexSource.indexOf('testID="screen-child-recovery-error"')).toBeLessThan(
        indexSource.indexOf('hasReachedHome ? "/(tabs)" : "/onboarding/child-status"')
      );
      // 복구 소스는 여전히 서버 목록 하나뿐이다(SQLite 대기 행에서 childId를 유추하지 않는다).
      expect(recoverySource()).toContain("fetchChildren(accessToken)");
      expect(recoverySource()).not.toContain("mutation_outbox");
    });
  });
});
