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
// 라운드 78 A: 이 모듈의 넷째 갈래는 화이트리스트 표다. 표의 판정을 이 파일이 다시 적지 않고,
// step-ui가 실제로 부르는 그 두 함수를 **그대로 평가해** 값을 확인한다.
import { apiErrorCodeOf, apiErrorMessageForCode, ApiHttpError, API_ERROR_MESSAGES } from "../api/api-error";
import { CHILD_BIRTH_DATE_TOO_OLD_ERROR } from "../children/child-form";
// 라운드 78 리뷰 M-2: CHILD_NOT_FOUND의 온보딩 문장은 아이 삭제 흐름의 그 문장 그대로다.
import { DESTRUCTIVE_FLOW_MESSAGE_BY_CODE } from "../settings/destructive-flow-messages";

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
    // 라운드 72 리뷰 S-4: **아이 id 하나만 남은 경합.** 두 스토어는 각자 flush되므로 ONB-002
    // 성공 직후 앱이 죽으면 이 상태가 실제로 남는다. 종전 판정은 여기서 null이었고, 그래서
    // 이 트랙이 없애려던 중복 생성 창이 그 창에서 그대로 되살아났다. id는 ONB-002 성공에서만
    // 생기므로(child-profile.tsx · 데모 세션의 재선택) 그 자체를 통과 증거로 인정한다.
    { completed: [], childId: CHILD_ID, destination: "/onboarding/prepared-items" },
    // ONB-001까지만 + 아이 없음: 아이가 만들어지기 전이라 되돌아가도 잃을 것이 없다.
    { completed: ["ONB-001"], childId: null, destination: null },
    // ONB-001 표시 + 아이 id: 같은 경합의 더 흔한 모양이다(ONB-001은 이미 flush됐고 ONB-002
    // 표시만 늦었다). 아이가 이미 있으므로 "되돌아가도 잃을 것이 없다"는 전제가 깨져 있다.
    { completed: ["ONB-001"], childId: CHILD_ID, destination: "/onboarding/prepared-items" },
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

  /**
   * 라운드 72 리뷰 S-4 — **두 스토어의 논리곱을 요구하지 않는다(한 방향만).**
   *
   * `selectedChildId`와 `completedStepIds`는 서로 다른 zustand persist 스토어이고 쓰는 순간도
   * 두 번이다(child-profile.tsx의 저장 성공이 잇달아 부른다). 한쪽만 flush된 창에서 콜드
   * 스타트하면 종전 판정은 `null`로 떨어져 ONB-001로 되돌아갔다 — 이 트랙이 없애려던 중복
   * 생성 창이 그 경합에서 되살아난 것이다.
   */
  it("아이 id만 남은 경합에서도 ONB-001로 되돌리지 않는다 (완화는 한 방향뿐이다)", () => {
    // 아이 id 자체가 ONB-002 통과의 증거다 — 완료 표시가 없어도, ONB-001까지만 있어도 같다.
    for (const completed of [[], ["ONB-001"]] as OnboardingScreenId[][]) {
      expect(localOnboardingNextStep(facts(completed, CHILD_ID))).toBe("prepared-items");
    }
    // 더 뒤 단계의 표시가 있으면 그쪽이 여전히 이긴다(주입이 순서를 되돌리지 않는다).
    expect(localOnboardingNextStep(facts(["ONB-003"], CHILD_ID))).toBe("budget");
    expect(localOnboardingNextStep(facts(["ONB-004"], CHILD_ID))).toBe("budget");
    // ⚠ 반대 방향은 그대로다: 스텝 표시만 있고 아이 id가 없으면 폴백이 서지 않는다
    // (아이 없이는 ONB-003·ONB-004에서 아무것도 누를 수 없다).
    for (const completed of [[], ["ONB-001"], ["ONB-002"], ["ONB-003"], ["ONB-004"]] as OnboardingScreenId[][]) {
      expect(localOnboardingNextStep(facts(completed, null)), `아이 없음: ${completed}`).toBeNull();
    }
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

  /**
   * 라운드 72 리뷰 S-5 — **이 탈출구가 약속하지 않는 것을 값으로 적어 둔다.**
   *
   * 로컬 통과는 `completeStep("ONB-003")` **로컬 표시 하나**다. 서버에는 `preparedItemsSetAt`이
   * 서지 않으므로 다음 실행에서 진행도 조회가 **성공하면** 서버의 이어하기 대상이 다시 이
   * 화면이다(`app/index.tsx`는 서버가 답하면 로컬 폴백을 보지 않는다 — 계약 ⓐ의 그 순서).
   *
   * 그래도 막다른 길이 아니라는 것이 이 줄의 요점이다: 돌아온 그 순간에는 연결이 있으므로
   * 기본 버튼이 0건 저장을 실제로 보내고 한 번에 지나간다. 그리고 체크가 하나라도 있으면
   * 탈출구가 애초에 열리지 않으므로, 되돌아온 화면에서 사용자가 잃는 선택도 없다.
   * **그래서 UI는 한 글자도 바뀌지 않는다** — 화면에 이 사실을 안내로 적으면 대개 일어나지 않을
   * 일을 미리 말하게 된다. 사실은 화면 주석과 이 계약에만 남는다.
   */
  it("로컬 통과는 서버 표시를 남기지 않는다 (다음 온라인 콜드 스타트에 이 화면을 다시 본다)", () => {
    const screen = source(PREPARED_ITEMS_PATH);
    // 탈출구는 서버로 아무것도 보내지 않는다(같은 저장을 몰래 태우지 않는다).
    const passBlock = screen.slice(screen.indexOf("function passLocally()"), screen.indexOf("return (", screen.indexOf("function passLocally()")));
    expect(passBlock).toContain('completeStep("ONB-003");');
    expect(passBlock, "탈출구가 서버 쓰기를 태우지 않는다").not.toContain("save.mutate()");
    expect(passBlock, "탈출구가 서버 쓰기를 태우지 않는다").not.toContain("setPreparedItems");
    // 그래서 다음 실행의 이어하기는 서버가 답하는 한 이 화면으로 되돌아온다 — 그 사실이
    // 화면 주석에 값으로 남아 있다(다음 라운드가 "왜 또 여기지?"를 다시 세지 않게).
    expect(screen).toContain("preparedItemsSetAt");
    // ⚠ UI 무변경: 이 사실을 안내 문장으로 화면에 적지 않는다.
    expect(screen, "아직 일어나지 않은 일을 미리 말하지 않는다").not.toContain("다시 물어볼게요");
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

  /**
   * 모르는 실패의 폴백 문장. 화면 모듈을 import할 수 없으므로 값으로 적고, **그 값이 소스의
   * 상수 선언과 같다는 사실**을 아래 두 케이스가 함께 못박는다(라운드 60 #3 이후 바이트 불변).
   */
  const ONBOARDING_SAVE_FAILED_MESSAGE_TEXT = "저장하지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.";

  /**
   * 라운드 72 리뷰 M-2 · S-1 — **폴 배선은 공용 한 벌이고, 죽은 인자는 없다.**
   *
   * 종전에는 이 화면 모듈이 `useState` + `isCurrentlyOnline().then((online) => {…})` +
   * cancelled 가드를 손으로 다시 적고 있었다(형태만 privacy 화면과 같았다). 그 사본을
   * `useErrorTimeConnectivity` 한 벌로 옮겼으므로, 여기서 확인하는 것은 **같은 사실이
   * 인자 하나로 표현되는가**다 — cancelled 가드·복원 자체의 계약은 공용 훅 쪽
   * (`src/shared-decision-wiring.test.ts` ⓐ-1)이 진다.
   */
  it("실패 시점 연결 판정을 공용 배선 한 벌에서 받는다", () => {
    expect(stepUi).toContain('import { useErrorTimeConnectivity } from "../offline/use-load-error-copy";');
    // 데모 세션 갈래는 **인자**로만 남는다(폴을 돌리지 않는다는 뜻이다).
    expect(stepUi).toContain("const isOnline = useErrorTimeConnectivity(!isDemoSession);");
    // 재구현이 남지 않는다 — 폴도 가드도 이 파일의 **코드**에 없다(머리말이 라운드 72 정찰의
    // 전수 grep을 인용하므로 주석을 걷어내고 본다).
    const stepUiCode = stepUi.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    expect(stepUiCode).not.toContain("isCurrentlyOnline");
    expect(stepUiCode).not.toContain("let cancelled = false;");
    // 카드가 그 판정을 문구 함수에 넘긴다. 라운드 72 리뷰 S-1: 이 카드는 실패했을 때만 그려져
    // 종전 인자가 언제나 리터럴 `true`였고, 갈래를 만들지 않는 인자는 시그니처에서 사라졌다.
    expect(stepUi).toContain("export function useOnboardingSaveFailureConnectivity(): boolean {");
    expect(stepUi).toContain("const isOnline = useOnboardingSaveFailureConnectivity();");
    expect(stepUi).not.toContain("useOnboardingSaveFailureConnectivity(true)");
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

  /* -------------------------------------------------------------------------------------- */
  /* 라운드 78 A(+리뷰 M-1·M-2) — 갈래가 다섯이 된다: 전용 셋 → 표 → 오프라인 → 전용 폴백       */
  /* -------------------------------------------------------------------------------------- */

  /**
   * ⚠️ 이 모듈은 **아는 코드가 둘뿐이었고 화이트리스트 표를 부르지 않았다.** 그래서 서버가
   * 이유를 코드로 말해 준 실패까지 전부 마지막 폴백 한 문장으로 접혔고, 표에 **이미 있던**
   * `CHILD_BIRTH_DATE_TOO_OLD`조차 온보딩 화면에는 구조적으로 설 수 없었다 — 같은 실패가 아이
   * 관리 화면(app/settings/children.tsx → useSaveErrorCopy → resolveSaveErrorCopy → 표)에서는
   * *"20년보다 오래된 날은 고를 수 없어요."* 인데 온보딩에서는 *"저장하지 못했어요…"* 였다.
   * **한 여정의 두 화면이 같은 실패를 정반대로 말하던 자리**다.
   *
   * 화면 모듈은 react-native를 끌고 와 vitest에서 import할 수 없으므로(이 파일의 관례),
   * 갈래의 **순서**는 소스로 고정하고, 그 갈래가 내는 **값**은 모듈이 실제로 부르는 그 식
   * (`apiErrorMessageForCode(apiErrorCodeOf(error))`)을 **그대로 평가해** 확인한다 — 판정의
   * 사본을 이 파일에 만들지 않는다.
   */
  /**
   * ⚠️ **라운드 78 리뷰 M-1** — 처음 이 갈래는 표를 오프라인 **뒤**에 두고 *"오프라인으로
   * 판정된 실패에는 서버 코드가 애초에 없다"* 를 근거로 적었다. 그 근거는 거짓이다:
   * `isOnline`은 실패 값에서 파생한 값이 아니라 카드가 마운트되는 순간 도는 **독립된 폴 한 번**
   * 이다. 그래서 순서를 **코드 → 오프라인**으로 되돌린다(표를 직접 보는 저장소의 다른 둘 —
   * `resolveSaveErrorCopy`·`memberMutationErrorMessage` — 이 세운 그 순서다).
   *
   * 갈래의 **줄 순서 자체**를 값으로 못 박는다: 화면 모듈을 import할 수 없으므로(이 파일의
   * 관례) 판정의 사본을 만드는 대신 함수 본문에서 갈래 줄만 뽑아 배열로 비교한다. 한 줄이라도
   * 자리를 바꾸면 여기가 빨개진다.
   */
  it("갈래 다섯의 줄 순서: 전용 셋 → 표 → 오프라인 → 폴백", () => {
    const start = stepUi.indexOf("export function onboardingSaveErrorMessage(");
    // 시작·끝의 실재를 먼저 묻는다 — indexOf가 -1이면 구간이 엉뚱한 곳에서 시작한다.
    expect(start).toBeGreaterThan(-1);
    const end = stepUi.indexOf("\n}\n", start);
    expect(end).toBeGreaterThan(start);
    const body = stepUi.slice(start, end);

    const branchLines = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("if (") || line.startsWith("const knownByCode") || line.startsWith("return "));

    expect(branchLines).toEqual([
      "if (isOnboardingConsentRequired(error)) return ONBOARDING_CONSENT_REQUIRED_MESSAGE;",
      "if (isOnboardingSaveForbidden(error)) return ONBOARDING_SAVE_FORBIDDEN_MESSAGE;",
      'if (hasApiErrorCode(error, "CHILD_NOT_FOUND")) return ONBOARDING_CHILD_GONE_MESSAGE;',
      "const knownByCode = apiErrorMessageForCode(apiErrorCodeOf(error));",
      "if (knownByCode) return knownByCode;",
      "if (!isOnline) return OFFLINE_RETRY_NOTICE;",
      "return ONBOARDING_SAVE_FAILED_MESSAGE;"
    ]);

    expect(stepUi).toContain('import { apiErrorCodeOf, apiErrorMessageForCode } from "../api/api-error";');
    // 문구를 이 파일에 사본으로 적지 않는다 — 표의 문장이 step-ui에 리터럴로 들어오면 안 된다.
    for (const code of ["CHILD_BIRTH_DATE_FUTURE", "CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED", "CHILD_NOT_FOUND"]) {
      expect(stepUi, code).not.toContain(API_ERROR_MESSAGES[code]);
    }
  });

  /**
   * **재현** — 서버가 400을 주고, 그 직후 폴이 오프라인을 말한다.
   *
   * 종전 순서(표가 오프라인 뒤)에서는 이 조합이 *"지금은 오프라인이에요…"* 로 접혔다 —
   * 서버가 이유를 코드로 말해 준 실패에 연결 이야기를 하는 것이 또 하나의 틀린 안내다.
   * 두 사실을 함께 못 박는다: ⓐ 표가 그 코드에 문장을 준다(값), ⓑ 그 갈래가 오프라인 줄보다
   * **먼저** 선다(줄 순서) — 그래서 `isOnline: false`여도 답은 표의 문장이다.
   */
  it("400 + 오프라인 폴이 겹쳐도 표의 문장이 선다 (코드가 오프라인보다 먼저다)", () => {
    const transition = new ApiHttpError(400, {
      error: { code: "CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED", message: "…", requestId: "req-2" }
    });
    const byCode = apiErrorMessageForCode(apiErrorCodeOf(transition));
    expect(byCode).toBe(API_ERROR_MESSAGES.CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED);
    // 두 답이 실제로 다르다 — 순서가 값을 바꾸는 자리라는 뜻이다(같으면 이 계약은 무의미하다).
    expect(byCode).not.toBe(OFFLINE_RETRY_NOTICE);

    const tableIndex = stepUi.indexOf("const knownByCode = apiErrorMessageForCode(apiErrorCodeOf(error));");
    const offlineIndex = stepUi.indexOf("if (!isOnline) return OFFLINE_RETRY_NOTICE;");
    expect(tableIndex).toBeGreaterThan(-1);
    expect(offlineIndex).toBeGreaterThan(tableIndex);

    // 코드를 모르는 실패에서는 종전 그대로 오프라인 문장이 선다(그 갈래는 사라지지 않았다).
    expect(apiErrorMessageForCode(apiErrorCodeOf(new Error("Network request failed")))).toBeNull();
  });

  /**
   * **라운드 78 리뷰 M-2** — 표의 `CHILD_NOT_FOUND` 문장은 *"아이 목록에서 확인해 주세요"* 로
   * 끝나는데 **온보딩에는 그 목적지가 없다.** 도달 경로는 실재한다(공동양육자가 그사이 아이를
   * 지우면 ONB-003·004 저장이 404를 받는다). 그래서 이 코드만 표보다 앞에서 가로채고, 문장은
   * 아이 삭제 흐름이 이미 쓰는 그것을 **그대로 읽는다**(새 한국어 문장 0건).
   */
  it("CHILD_NOT_FOUND는 표보다 앞에서 갈리고, 없는 목적지를 가리키지 않는다", () => {
    expect(stepUi).toContain(
      "export const ONBOARDING_CHILD_GONE_MESSAGE = DESTRUCTIVE_FLOW_MESSAGE_BY_CODE.child_profile_delete.CHILD_NOT_FOUND;"
    );
    const shown = DESTRUCTIVE_FLOW_MESSAGE_BY_CODE.child_profile_delete.CHILD_NOT_FOUND;
    // 이 화면에 없는 목적지를 가리키지 않는다(표의 문장은 정확히 그것 때문에 못 선다).
    expect(API_ERROR_MESSAGES.CHILD_NOT_FOUND).toContain("아이 목록에서");
    expect(shown).not.toContain("아이 목록");
    expect(shown).not.toContain("탭");
    // 다시 눌러도 결과가 같은 실패다 — 재시도를 권하지 않는다.
    expect(shown).not.toContain("다시 시도");
    // 갈래가 표보다 앞이다(줄 순서는 위 케이스가 전량으로 문다).
    const childGoneIndex = stepUi.indexOf('if (hasApiErrorCode(error, "CHILD_NOT_FOUND")) return ONBOARDING_CHILD_GONE_MESSAGE;');
    const tableIndex = stepUi.indexOf("const knownByCode = apiErrorMessageForCode(apiErrorCodeOf(error));");
    expect(childGoneIndex).toBeGreaterThan(-1);
    expect(tableIndex).toBeGreaterThan(childGoneIndex);

    // ⚠️ ITEM_NOT_FOUND는 같은 병이 아니다 — 온보딩 저장 셋은 그 코드를 던지는 파일을 지나지
    // 않는다(ONB-003의 저장은 없는 템플릿 id를 조용히 걸러 낸다). 그래서 갈래를 세우지 않는다.
    expect(stepUi).not.toContain("ITEM_NOT_FOUND\"");
  });

  /**
   * **재현** — 표의 아무 코드로나 그 문장이 실제로 선다.
   *
   * 실패 시나리오 그대로다: 공동양육자가 먼저 [아이가 태어났어요]를 눌러 전환을 마친 뒤, 어제
   * 열어 둔 화면에서 같은 버튼을 누르면 서버가 400 `CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED`로
   * 막는다. 종전에는 그 자리에 *"저장하지 못했어요. …다시 시도해 주세요."* 가 섰고, 30초 뒤
   * 다시 눌러도 같은 문장이었다.
   */
  it("아는 코드는 표의 문장이 되고, 모르는 실패의 폴백은 바이트 불변이다", () => {
    const transition = new ApiHttpError(
      400,
      { error: { code: "CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED", message: "…", requestId: "req-1" } }
    );
    const shown = apiErrorMessageForCode(apiErrorCodeOf(transition));
    expect(shown).toBe(API_ERROR_MESSAGES.CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED);
    expect(shown).not.toBe(ONBOARDING_SAVE_FAILED_MESSAGE_TEXT);
    expect(shown).not.toBe(OFFLINE_RETRY_NOTICE);

    // 표에 **이미 있던** 그 코드도 이제 이 화면에 설 수 있다(아이 관리 화면과 같은 문장이다).
    const tooOld = new ApiHttpError(400, { error: { code: "CHILD_BIRTH_DATE_TOO_OLD", message: "…" } });
    expect(apiErrorMessageForCode(apiErrorCodeOf(tooOld))).toBe(CHILD_BIRTH_DATE_TOO_OLD_ERROR);

    // 모르는 코드·코드 없는 실패는 표가 null을 돌려주고, 아랫줄의 폴백이 종전 그대로 선다.
    expect(apiErrorMessageForCode(apiErrorCodeOf(new ApiHttpError(500, { error: { code: "INTERNAL_ERROR" } })))).toBeNull();
    expect(apiErrorMessageForCode(apiErrorCodeOf(new Error("Network request failed")))).toBeNull();
    expect(stepUi).toContain(`export const ONBOARDING_SAVE_FAILED_MESSAGE = "${ONBOARDING_SAVE_FAILED_MESSAGE_TEXT}";`);
  });

  /**
   * ⚠️ **전용 둘의 출력은 표가 생겨도 바뀌지 않는다.**
   * `FORBIDDEN`은 표에도 있지만 이 화면에서 사용자가 알아야 할 사실은 중립 문구가 아니라
   * "가족 관리자에게 부탁하라"이고, `CONSENT_REQUIRED`는 문구가 아니라 **복구 동선**이 답이라
   * 표에 아예 넣지 않았다(넣으면 전용 버튼을 잃는다).
   */
  it("전용 둘은 표보다 앞이고, CONSENT_REQUIRED는 표에 들어오지 않았다", () => {
    // 403의 표 문구와 이 화면의 문구는 서로 다른 문장이다 — 순서가 그 차이를 지킨다.
    expect(API_ERROR_MESSAGES.FORBIDDEN).not.toBe(
      "권한이 없어 저장하지 못했어요. 가족 관리자에게 아이 등록을 부탁해 주세요."
    );
    expect(stepUi).toContain('"권한이 없어 저장하지 못했어요. 가족 관리자에게 아이 등록을 부탁해 주세요."');
    // 복구 동선을 잃지 않는다: 이 코드는 표에 없고, 전용 버튼이 그대로 선다.
    expect(API_ERROR_MESSAGES.CONSENT_REQUIRED).toBeUndefined();
    expect(apiErrorMessageForCode("CONSENT_REQUIRED")).toBeNull();
    expect(stepUi).toContain("label={ONBOARDING_CONSENT_RETRY_ACTION_LABEL}");
  });
});
