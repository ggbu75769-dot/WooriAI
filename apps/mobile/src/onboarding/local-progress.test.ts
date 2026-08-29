import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  canPassPreparedItemsLocally,
  hasLocallyCreatedChild,
  highestCompletedOnboardingStep,
  localOnboardingNextStep,
  localOnboardingResumeRoute,
  LOCAL_ONBOARDING_NEXT_STEP_BY_HIGHEST_COMPLETED,
  ONBOARDING_CHILD_ALREADY_CREATED_CONTINUE_LABEL,
  ONBOARDING_CHILD_ALREADY_CREATED_NOTICE,
  PREPARED_ITEMS_LOCAL_PASS_LABEL
} from "./local-progress";
import { routeForOnboardingNextStep } from "./resume";
import { onboardingSteps, type OnboardingScreenId } from "./steps";
import { OFFLINE_RETRY_NOTICE } from "../offline/messages";

/**
 * 라운드 72 트랙 A(#1) — **가입 첫 10분**의 계약.
 *
 * 화면 파일은 react-native를 끌고 와 vitest에서 import할 수 없으므로(이 저장소의 관례),
 * 판정은 순수 모듈에서 값으로 확인하고 **배선**은 소스 대조로 고정한다.
 */
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const INDEX_PATH = "app/index.tsx";
const PREPARED_ITEMS_PATH = "app/(onboarding)/prepared-items.tsx";
const CHILD_PROFILE_PATH = "app/(onboarding)/child-profile.tsx";
const STEP_UI_PATH = "src/onboarding/step-ui.tsx";
const MODULE_PATH = "src/onboarding/local-progress.ts";

const CHILD_ID = "11111111-1111-4111-8111-111111111111";
const facts = (completedStepIds: OnboardingScreenId[], selectedChildId: string | null) => ({
  completedStepIds,
  selectedChildId
});

/* ============================================================================================ */
/* 계약 ⓐ — 서버 진행도가 답하지 않을 때의 목적지 표                                             */
/* ============================================================================================ */

describe("계약 ⓐ: 서버가 답하지 않을 때의 목적지 표", () => {
  /**
   * 정찰 노트가 요구한 좌표 그대로다:
   * (완료 표시 있음 · ONB-002까지 있음 · 아무것도 없음) × (아이 id 있음 / 없음).
   * 표를 값으로 남겨 두면 다음 라운드가 한 칸을 바꿀 때 그 칸의 근거를 함께 적게 된다.
   */
  const table: Array<{ completed: OnboardingScreenId[]; childId: string | null; destination: string | null }> = [
    // 아무것도 없음 -> 폴백은 아무 말도 하지 않는다(= 종전 목적지 그대로).
    { completed: [], childId: null, destination: null },
    { completed: [], childId: CHILD_ID, destination: null },
    // ONB-001까지만: 아이가 만들어지기 전이라 되돌아가도 잃을 것이 없다.
    { completed: ["ONB-001"], childId: null, destination: null },
    { completed: ["ONB-001"], childId: CHILD_ID, destination: null },
    // ONB-002까지: **이 트랙의 본체.** ONB-001로 되돌리면 그 길 끝에서 아이가 하나 더 생긴다.
    { completed: ["ONB-001", "ONB-002"], childId: CHILD_ID, destination: "/onboarding/prepared-items" },
    // 완료 표시가 있어도 아이 id가 없으면 폴백은 서지 않는다(빈 화면에 사람을 세우지 않는다).
    { completed: ["ONB-001", "ONB-002"], childId: null, destination: null },
    // ONB-003까지: 남은 것은 예산 한 단계다.
    { completed: ["ONB-001", "ONB-002", "ONB-003"], childId: CHILD_ID, destination: "/onboarding/budget" },
    { completed: ["ONB-001", "ONB-002", "ONB-003"], childId: null, destination: null },
    // ONB-004까지: 그래도 "완료"가 아니다 -- 마지막 단계를 한 번 더 보여 준다.
    { completed: ["ONB-002", "ONB-003", "ONB-004"], childId: CHILD_ID, destination: "/onboarding/budget" },
    { completed: ["ONB-002", "ONB-003", "ONB-004"], childId: null, destination: null }
  ];

  it.each(table)("완료표시=$completed · 아이id=$childId -> $destination", ({ completed, childId, destination }) => {
    expect(localOnboardingResumeRoute(facts(completed, childId))).toBe(destination);
  });

  it("저장된 배열의 순서를 믿지 않는다 (persist된 blob은 steps.ts 순서가 아닐 수 있다)", () => {
    expect(highestCompletedOnboardingStep(["ONB-003", "ONB-001", "ONB-002"])).toBe("ONB-003");
    expect(highestCompletedOnboardingStep(["ONB-002"])).toBe("ONB-002");
    expect(highestCompletedOnboardingStep([])).toBeNull();
  });

  /**
   * **부정 단언(설계 긴장 ⓑ).** 폴백이 정하는 것은 다음 단계이지 완료가 아니다. `"home"`이
   * 표에 들어오는 순간 예산 단계가 통째로 사라진다.
   */
  it('폴백은 "home"(=온보딩 완료)을 절대 돌려주지 않는다', () => {
    for (const value of Object.values(LOCAL_ONBOARDING_NEXT_STEP_BY_HIGHEST_COMPLETED)) {
      expect(value).not.toBe("home");
    }
    for (const row of table) {
      expect(row.destination).not.toBe("/(tabs)");
      expect(localOnboardingNextStep(facts(row.completed, row.childId))).not.toBe("home");
    }
  });

  /** 라우트 표는 한 벌뿐이다 -- 이 모듈은 `resume.ts`의 표를 읽어 쓴다(파생 단언). */
  it("목적지는 resume.ts의 라우트 표에서 그대로 온다 (표가 두 벌이 아니다)", () => {
    expect(source(MODULE_PATH)).toContain('import { routeForOnboardingNextStep } from "./resume";');
    for (const [screenId, nextStep] of Object.entries(LOCAL_ONBOARDING_NEXT_STEP_BY_HIGHEST_COMPLETED)) {
      if (nextStep === null) continue;
      expect(localOnboardingResumeRoute(facts([screenId as OnboardingScreenId], CHILD_ID))).toBe(
        routeForOnboardingNextStep(nextStep)
      );
    }
    // 표의 키는 steps.ts의 네 단계와 1:1이다(단계가 늘면 여기서 빨개진다).
    expect(Object.keys(LOCAL_ONBOARDING_NEXT_STEP_BY_HIGHEST_COMPLETED)).toEqual(
      onboardingSteps.map((step) => step.screenId)
    );
  });

  /**
   * **부정 단언: 서버가 답했을 때는 한 글자도 바뀌지 않는다.** 폴백은 `progressFetch`가 끝났고
   * 서버가 답하지 **않은** 갈래에서만 산다(catch · 3초 밸브).
   */
  it("app/index.tsx: 폴백은 catch·3초 밸브 갈래에서만 서고, 종전 목적지 리터럴은 그대로다", () => {
    const indexSource = source(INDEX_PATH);

    // 종전 목적지(라운드 51 #2 · onboarding-resume.test.ts가 고정한 그 문자열) 불변.
    expect(indexSource).toContain('hasReachedHome ? "/(tabs)" : "/onboarding/child-status"');
    // 서버가 답한 경우를 세는 값이 있고, 폴백은 그 값이 false일 때만 계산된다.
    expect(indexSource).toContain("setProgressAnswered(true);");
    expect(indexSource).toContain('progressFetch === "done" && !progressAnswered');
    expect(indexSource).toContain("localOnboardingResumeRoute({ completedStepIds, selectedChildId })");
    // 이어하기(ONB-006)가 먼저다 -- 서버 진행도가 있으면 종전 화면을 그대로 지난다.
    const resumeIndex = indexSource.indexOf('<Redirect href="/onboarding/resume" />');
    const fallbackIndex = indexSource.indexOf("<Redirect href={localResumeHref} />");
    expect(resumeIndex).toBeGreaterThan(-1);
    expect(fallbackIndex).toBeGreaterThan(resumeIndex);

    // 성공 갈래에서만 답했다고 센다: `.catch(` 뒤에는 setProgressAnswered가 없다.
    const afterCatch = indexSource.slice(indexSource.indexOf(".catch(() => {"));
    expect(afterCatch).not.toContain("setProgressAnswered");
  });

  /** 3초 밸브·하이드레이션 밸브는 무변경이다(조건식·시간 그대로). */
  it("app/index.tsx: 두 안전 밸브의 조건식과 3초가 그대로다", () => {
    const indexSource = source(INDEX_PATH);
    expect(indexSource).toContain("const fallback = setTimeout(() => setHydrated(true), 3000);");
    expect(indexSource).toContain('const fallback = setTimeout(() => setProgressFetch("done"), 3000);');
  });

  /**
   * 금지 사항의 값 고정: 폴백은 `hasReachedHome`을 세우지 않고, `resetOnboarding()` 호출 지점을
   * 늘리지 않는다(지우는 순간 이 폴백이 읽을 사실이 사라진다).
   */
  it("app/index.tsx: markHomeReached()·resetOnboarding() 호출 지점이 늘지 않았다", () => {
    const indexSource = source(INDEX_PATH);
    expect(indexSource.match(/markHomeReached\(\)/g) ?? []).toHaveLength(1);
    expect(indexSource.match(/resetOnboarding\(\)/g) ?? []).toHaveLength(1);
  });

  /** MOB-116 복구 경로(라운드 71 C의 자리)는 읽기만 한다 -- 이 트랙이 손대지 않았다. */
  it("app/index.tsx: 아이 복구 배선은 그대로다", () => {
    const indexSource = source(INDEX_PATH);
    expect(indexSource).toContain("useSelectedChildRecovery(");
    expect(indexSource).toContain("{ isCurrentlyOnline, subscribeAppStateChange }");
  });

  /** 서버 0건: 이 판정 모듈은 API 클라이언트를 부르지 않는다(순수 모듈). */
  it("판정 모듈은 서버를 부르지 않는다 (타입 import만 지난다)", () => {
    const moduleSource = source(MODULE_PATH);
    expect(moduleSource).toContain('import type { OnboardingNextStep } from "../api/client";');
    expect(moduleSource).not.toMatch(/^import \{[^}]*\} from "\.\.\/api\/client";/m);
    expect(moduleSource).not.toContain("fetch(");
  });
});

/* ============================================================================================ */
/* 계약 ⓓ — 아이가 두 번 만들어지지 않는다 (시나리오)                                            */
/* ============================================================================================ */

describe("계약 ⓓ: ONB-002 성공 → 진행도 조회 실패 → 콜드 스타트", () => {
  beforeEach(async () => {
    const { useOnboardingProgressStore } = await import("../stores/onboarding-progress.store");
    const { useSelectedChildStore } = await import("../stores/selected-child.store");
    useOnboardingProgressStore.getState().resetOnboarding();
    useSelectedChildStore.getState().clearSelectedChildId();
  });

  /**
   * `POST /children`이 일어나는 유일한 화면은 ONB-002이고, 온보딩에서 그 화면으로 들어가는
   * 입구는 ONB-001이다. 폴백의 목적지가 그 둘 중 어느 것도 아니라는 사실이 곧
   * "아이를 다시 만들지 않는다"이다.
   */
  const childCreateRoutes = onboardingSteps
    .filter((step) => step.screenId === "ONB-001" || step.screenId === "ONB-002")
    .map((step) => step.route);

  it("아침에 만든 아이가 저녁의 콜드 스타트에서 ONB-001로 되돌아가지 않는다", async () => {
    const { useOnboardingProgressStore } = await import("../stores/onboarding-progress.store");
    const { useSelectedChildStore } = await import("../stores/selected-child.store");

    // 1) ONB-002 저장 성공 -- child-profile.tsx의 onSuccess가 하는 일 그대로다.
    useSelectedChildStore.getState().setSelectedChildId(CHILD_ID);
    useOnboardingProgressStore.getState().completeStep("ONB-002");
    useOnboardingProgressStore.getState().clearChildCreateIdempotencyKey();
    // 멱등키가 지워졌다 = 서버는 두 번째 제출을 막지 않는다(선행 확인 7). 그래서 라우팅이
    // 되돌려 보내면 정말로 아이가 하나 더 생긴다.
    expect(useOnboardingProgressStore.getState().childCreateIdempotencyKey).toBeNull();

    // 2) 저녁: 진행도 조회가 실패했다(서버가 답하지 않았다). 앱은 온보딩을 끝냈다고 알지 못한다.
    expect(useOnboardingProgressStore.getState().hasReachedHome).toBe(false);

    // 3) 이 기기가 아는 사실로 정한 목적지.
    const destination = localOnboardingResumeRoute({
      completedStepIds: useOnboardingProgressStore.getState().completedStepIds,
      selectedChildId: useSelectedChildStore.getState().selectedChildId
    });

    expect(destination).toBe("/onboarding/prepared-items");
    // 부정 단언: 아이를 만드는 두 화면 어느 쪽으로도 가지 않는다.
    for (const route of childCreateRoutes) {
      expect(destination).not.toBe(route);
    }
    expect(childCreateRoutes).toEqual(["/onboarding/child-status", "/onboarding/child-profile"]);
  });

  it("아무것도 남기지 않은 계정은 종전 그대로 ONB-001에서 시작한다", async () => {
    const { useOnboardingProgressStore } = await import("../stores/onboarding-progress.store");
    const { useSelectedChildStore } = await import("../stores/selected-child.store");

    expect(
      localOnboardingResumeRoute({
        completedStepIds: useOnboardingProgressStore.getState().completedStepIds,
        selectedChildId: useSelectedChildStore.getState().selectedChildId
      })
    ).toBeNull();
  });

  /** ONB-002가 그래도 다시 열린 경우의 최후 방어 -- 막지 않고 사실을 말한다(서버 0건). */
  describe("최후 방어: ONB-002가 아이 id를 가진 채 다시 열린 경우", () => {
    it("이미 만든 아이가 있을 때만 안내가 선다", () => {
      expect(hasLocallyCreatedChild(facts(["ONB-002"], CHILD_ID))).toBe(true);
      expect(hasLocallyCreatedChild(facts(["ONB-002"], null))).toBe(false);
      expect(hasLocallyCreatedChild(facts(["ONB-001"], CHILD_ID))).toBe(false);
      expect(hasLocallyCreatedChild(facts([], CHILD_ID))).toBe(false);
    });

    it("화면이 그 안내와 이어가는 길을 함께 그리고, 폼·[다음]은 그대로다", () => {
      const screen = source(CHILD_PROFILE_PATH);
      expect(screen).toContain("hasLocallyCreatedChild({ completedStepIds, selectedChildId })");
      expect(screen).toContain("localOnboardingResumeRoute({ completedStepIds, selectedChildId })");
      expect(screen).toContain("ONBOARDING_CHILD_ALREADY_CREATED_NOTICE");
      expect(screen).toContain("router.replace(continueHref)");
      // 차단이 아니다: 저장 버튼과 멱등키 배선은 한 줄도 바뀌지 않았다.
      expect(screen).toContain('label={save.isPending ? "저장하는 중" : "다음"}');
      expect(screen).toContain("getOrCreateChildCreateIdempotencyKey()");
      expect(screen).toContain("clearChildCreateIdempotencyKey()");
      // 서버 0건: 이 안내는 아무것도 조회하지 않는다.
      expect(screen).not.toContain("getOnboardingProgress");
    });

    it("안내는 사실만 말한다 (아이 이름을 지어내지 않고, 비난·지시형이 없다 -- DNC-018)", () => {
      expect(ONBOARDING_CHILD_ALREADY_CREATED_NOTICE).toBe(
        "이 기기에는 이미 등록한 아이가 있어요. 여기서 계속하면 아이가 하나 더 생겨요."
      );
      for (const sentence of ONBOARDING_CHILD_ALREADY_CREATED_NOTICE.split(". ")) {
        expect(sentence.trim()).toMatch(/요\.?$/);
      }
      expect(ONBOARDING_CHILD_ALREADY_CREATED_NOTICE).not.toMatch(/하세요|하십시오|주의|경고|오류|에러/);
      expect(ONBOARDING_CHILD_ALREADY_CREATED_CONTINUE_LABEL).toBe("등록한 아이로 계속하기");
    });
  });
});

/* ============================================================================================ */
/* 계약 ⓑ — ONB-003의 로컬 통과는 "체크 0건 + 저장 실패"에서만                                   */
/* ============================================================================================ */

describe("계약 ⓑ: ONB-003의 로컬 탈출구", () => {
  it("저장이 실패했고 체크가 0건일 때만 열린다", () => {
    expect(canPassPreparedItemsLocally({ checkedCount: 0, saveFailed: true })).toBe(true);
  });

  /**
   * **부정 단언.** "0건을 보내지 못한 것"과 "12건을 보내지 못한 것"은 다른 실패다 --
   * 체크가 있으면 로컬 통과는 저장한 척하는 일이 된다.
   */
  it.each([
    { checkedCount: 1, saveFailed: true, why: "체크가 있으면 열리지 않는다" },
    { checkedCount: 12, saveFailed: true, why: "체크가 많아도 마찬가지다" },
    { checkedCount: 0, saveFailed: false, why: "실패하기 전에는 열리지 않는다(서버 경로가 기본이다)" },
    { checkedCount: 3, saveFailed: false, why: "둘 다 아니면 당연히 닫혀 있다" }
  ])("$why", ({ checkedCount, saveFailed }) => {
    expect(canPassPreparedItemsLocally({ checkedCount, saveFailed })).toBe(false);
  });

  it("화면이 그 판정으로 버튼을 세우고, ONB-004의 skip과 같은 모양으로 통과시킨다", () => {
    const screen = source(PREPARED_ITEMS_PATH);
    expect(screen).toContain(
      "canPassPreparedItemsLocally({ checkedCount: checkedIds.length, saveFailed: save.isError })"
    );
    expect(screen).toContain("label={PREPARED_ITEMS_LOCAL_PASS_LABEL}");
    expect(screen).toContain('completeStep("ONB-003");');
    expect(screen).toContain('router.push("/onboarding/budget");');
    // 설계 긴장 ⓑ: 폴백도 탈출구도 온보딩 완료를 단정하지 않는다(예산 단계가 사라지면 안 된다).
    // 이 화면은 `markHomeReached`를 스토어에서 읽지조차 않는다(ONB-004만 그 권한을 갖는다).
    expect(screen).not.toContain("state.markHomeReached");
    // 서버 경로는 그대로다 -- 기본 버튼은 여전히 같은 뮤테이션을 태운다.
    expect(screen).toContain('canSkip ? "건너뛰고 계속" : "저장하고 계속"');
    expect(screen).toContain("onPress={() => save.mutate()}");
  });

  it("ONB-004의 로컬 건너뛰기는 한 줄도 바뀌지 않았다 (형식의 출처)", () => {
    const budget = source("app/(onboarding)/budget.tsx");
    expect(budget).toContain('completeStep("ONB-004");');
    expect(budget).toContain("markHomeReached();");
    expect(budget).toContain('<TextButton disabled={save.isPending} label="나중에 설정할게요" onPress={skip}');
  });

  it("라벨은 해요체이고 기본 버튼과 글자가 다르다 (DNC-018)", () => {
    expect(PREPARED_ITEMS_LOCAL_PASS_LABEL).toBe("나중에 체크할게요");
    expect(PREPARED_ITEMS_LOCAL_PASS_LABEL).toMatch(/요$/);
    expect(PREPARED_ITEMS_LOCAL_PASS_LABEL).not.toBe("건너뛰고 계속");
  });
});

/* ============================================================================================ */
/* 계약 ⓒ — 실패 문구가 연결을 확인하고 갈린다                                                   */
/* ============================================================================================ */

describe("계약 ⓒ: 온보딩 저장 실패 문구", () => {
  const stepUi = source(STEP_UI_PATH);

  it("실패 시점에 연결을 한 번 확인한다 (라운드 71 B가 쓴 그 형태)", () => {
    expect(stepUi).toContain('import { isCurrentlyOnline } from "../offline/connectivity";');
    expect(stepUi).toContain("void isCurrentlyOnline().then((online) => {");
    // 화면을 떠난 뒤 도착한 폴이 setState를 걸지 않는다(cancelled 가드).
    expect(stepUi).toContain("let cancelled = false;");
    expect(stepUi).toContain("if (!cancelled) setIsOnline(online);");
    // 에러가 풀리면 종전 상태로 복원된다.
    expect(stepUi).toContain("if (!isError || isDemoSession) {");
    // 카드가 그 판정을 문구 함수에 넘긴다.
    expect(stepUi).toContain("const isOnline = useOnboardingSaveFailureConnectivity(true);");
    expect(stepUi).toContain("onboardingSaveErrorMessage(error, { isOnline })");
  });

  it("데모 세션은 폴을 돌리지 않는다 (로컬 백엔드 실패는 연결과 무관하다)", () => {
    expect(stepUi).toContain("const isDemoSession = useSessionStore((state) => !state.accessToken && state.isTestSession);");
    expect(stepUi).toContain("return isDemoSession || isOnline;");
  });

  it("오프라인 문장은 공용 단일 소스에서 글자 그대로 온다 (새 문구 0건)", () => {
    expect(stepUi).toContain('import { OFFLINE_RETRY_NOTICE } from "../offline/messages";');
    expect(stepUi).toContain("if (!isOnline) return OFFLINE_RETRY_NOTICE;");
    expect(OFFLINE_RETRY_NOTICE).toBe("지금은 오프라인이에요. 연결된 뒤 다시 시도해 주세요.");
    // step-ui가 자기 오프라인 문장을 새로 짓지 않았다(부정 단언 -- 상수 선언이 0건이다).
    expect(stepUi).not.toMatch(/=\s*"지금은 오프라인/);
  });

  /**
   * **판정 순서 = 코드 → 오프라인 → 모르는 실패.** 서버가 답을 줬다는 사실 자체가 연결이
   * 있었다는 뜻이므로, 그 경우까지 오프라인으로 말하면 그것이 또 하나의 틀린 안내가 된다.
   */
  it("코드 갈래가 오프라인보다 먼저다", () => {
    const consentIndex = stepUi.indexOf("if (isOnboardingConsentRequired(error)) return ONBOARDING_CONSENT_REQUIRED_MESSAGE;");
    const forbiddenIndex = stepUi.indexOf("if (isOnboardingSaveForbidden(error)) return ONBOARDING_SAVE_FORBIDDEN_MESSAGE;");
    const offlineIndex = stepUi.indexOf("if (!isOnline) return OFFLINE_RETRY_NOTICE;");
    expect(consentIndex).toBeGreaterThan(-1);
    expect(forbiddenIndex).toBeGreaterThan(consentIndex);
    expect(offlineIndex).toBeGreaterThan(forbiddenIndex);
  });

  it("온라인·403·CONSENT_REQUIRED 갈래는 종전과 바이트 단위로 같다", () => {
    // 모르는 실패(온라인)의 문장 -- 라운드 60 #3 이후 한 글자도 바뀌지 않았다.
    expect(stepUi).toContain(
      'export const ONBOARDING_SAVE_FAILED_MESSAGE = "저장하지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.";'
    );
    expect(stepUi).toContain("return ONBOARDING_SAVE_FAILED_MESSAGE;");
    expect(stepUi).toContain(
      '"권한이 없어 저장하지 못했어요. 가족 관리자에게 아이 등록을 부탁해 주세요."'
    );
    // 인자를 넘기지 않은 호출부는 종전 그대로다(기본값 true).
    expect(stepUi).toContain("{ isOnline = true }: { isOnline?: boolean } = {}");
    // 403은 여전히 [재시도] 버튼 자체를 내린다.
    expect(stepUi).toContain(") : forbidden ? null : (");
  });
});
