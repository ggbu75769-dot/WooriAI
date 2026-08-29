import type { Href } from "expo-router";
import type { OnboardingNextStep } from "../api/client";
import { routeForOnboardingNextStep } from "./resume";
import { onboardingSteps, type OnboardingScreenId } from "./steps";

/**
 * 라운드 72 트랙 A(#1) — **서버가 답하지 않을 때, 기기가 이미 아는 사실로 다음 단계를 정한다.**
 *
 * ## 무엇이 잘못돼 있었나
 *
 * `app/index.tsx`의 진행도 조회는 실패를 `.catch`로 삼키고 있었고(그 자리 주석은 "로컬 zustand
 * persist가 오프라인 폴백"이라고 적었지만 **그 폴백을 실제로 읽는 코드가 없었다**), 그 뒤의
 * `!hasReachedHome` 분기는 오직 **서버가 준** 이어하기 대상만 봤다. 없으면 목적지는
 * `/onboarding/child-status` — **ONB-001부터 다시**다.
 *
 * 그런데 그 순간 이 기기는 답을 갖고 있다: `useOnboardingProgressStore.completedStepIds`에
 * `"ONB-002"`가 있고(`app/(onboarding)/child-profile.tsx`의 저장 성공이 적는다),
 * `useSelectedChildStore.selectedChildId`에는 방금 만든 아이의 id가 있다. 둘 다 persist다.
 *
 * 그래서 아침에 아이를 만든 사람이 저녁에 연결 없이 앱을 열면 ONB-001로 되돌아갔고, 거기서
 * 다시 걸어 나온 길이 `POST /children`을 한 번 더 불러 **같은 이름의 아이를 하나 더** 만들었다
 * (성공하면 멱등키가 지워지므로 — `child-profile.tsx`의 `clearChildCreateIdempotencyKey` —
 * 두 번째 제출은 새 키를 들고 나간다). 이 저장소에서 사용자가 가장 되돌리기 어려운 오염이고,
 * 그것을 만든 것은 사용자가 아니라 앱의 라우팅이었다.
 *
 * ## 이 모듈이 정하는 것과 정하지 않는 것
 *
 * **정하는 것: 다음 단계 하나뿐이다.** 이 표는 "온보딩을 끝냈다"를 절대 돌려주지 않는다 —
 * `"home"`이 표에 없는 것이 그 계약이다(부정 단언). 아이가 있다는 사실만으로 완료를 단정하면
 * 예산 단계(ONB-004)가 통째로 사라지고, 그 사람은 예산을 정할 기회를 영영 얻지 못한다.
 * 그래서 `hasReachedHome`은 이 폴백이 세우지 않는다(호출부의 금지 사항이기도 하다).
 *
 * **정하지 않는 것: 서버가 답한 경우.** 이 판정은 조회가 **실패했거나 3초 밸브에 걸린** 갈래
 * 에서만 산다. 서버가 답하면 종전 목적지가 한 글자도 바뀌지 않는다(라운드 51 #2가 데모 세션까지
 * 같은 관문으로 넣은 그 판정 위에 서고, 그 뒤에만 선다).
 *
 * ## 왜 라우트 표를 여기서 다시 적지 않는가
 *
 * `resume.ts`의 `routeForOnboardingNextStep`이 이미 "다음 단계 → 화면"의 단일 소스다. 이 모듈은
 * **어느 단계인가**만 정하고 라우트는 그 함수에서 받는다 — 표가 두 벌이 되면 한쪽만 고쳐도
 * 아무 테스트가 깨지지 않는다(이 저장소가 여러 라운드에 걸쳐 없애 온 그 모양이다).
 */

/** 이 판정이 읽는 **로컬 사실 두 가지**. 둘 다 zustand persist에서 그대로 온다. */
export type LocalOnboardingFacts = {
  /** `useOnboardingProgressStore.completedStepIds` — 이 기기가 통과 표시를 남긴 단계들. */
  completedStepIds: readonly OnboardingScreenId[];
  /** `useSelectedChildStore.selectedChildId` — 이미 만들어진 아이의 id. */
  selectedChildId: string | null;
};

/**
 * **목적지 표(계약 ⓐ).** 키는 이 기기가 통과 표시를 남긴 **가장 뒤 단계**이고, 값은 그때 갈
 * 다음 단계다. `null`은 "폴백이 아무 말도 하지 않는다" = 종전 목적지 그대로라는 뜻이다.
 *
 * 각 줄의 근거:
 *  - `ONB-001`(아이 상태 선택)까지만: 아이가 만들어지기 전이라 되돌아가도 잃을 것이 없다.
 *    `resume.ts`가 서버의 `"consents"`·`"child-profile"`을 똑같이 ONB-001로 보내는 것과 같은
 *    판단이다 — 그래서 이 줄은 종전과 같은 자리로 떨어진다(값으로는 `null`).
 *  - `ONB-002`(아이 프로필 저장 성공): **아이가 이미 서버에 있다.** 여기가 이 트랙의 본체다 —
 *    ONB-001로 되돌리면 그 길 끝에서 아이가 하나 더 생긴다.
 *  - `ONB-003`(준비물 제출): 남은 것은 예산 한 단계다.
 *  - `ONB-004`: 실제로는 `hasReachedHome`이 함께 서므로(budget.tsx의 저장·건너뛰기 둘 다
 *    `completeStep` 직후 `markHomeReached`) 이 줄에 닿는 경로는 두 스토어의 쓰기가 갈라진
 *    경우뿐이다. 그때도 **`"home"`을 돌려주지 않는다** — 폴백이 정하는 것은 다음 단계이지
 *    완료가 아니라는 계약을 이 줄이 지킨다. 마지막 단계를 한 번 더 보여 주면 그 화면의
 *    건너뛰기가 정상 경로로 홈까지 데려간다.
 */
export const LOCAL_ONBOARDING_NEXT_STEP_BY_HIGHEST_COMPLETED: Readonly<
  Record<OnboardingScreenId, OnboardingNextStep | null>
> = {
  "ONB-001": null,
  "ONB-002": "prepared-items",
  "ONB-003": "budget",
  "ONB-004": "budget"
};

/**
 * 이 기기가 통과 표시를 남긴 **가장 뒤 단계**. 순서는 `steps.ts`(진행 표시·계측과 같은 단일
 * 소스)에서 오고, 저장된 배열의 순서는 보지 않는다 — persist된 blob의 순서를 믿을 이유가 없다.
 */
export function highestCompletedOnboardingStep(
  completedStepIds: readonly OnboardingScreenId[]
): OnboardingScreenId | null {
  let highest: OnboardingScreenId | null = null;
  for (const step of onboardingSteps) {
    if (completedStepIds.includes(step.screenId)) highest = step.screenId;
  }
  return highest;
}

/**
 * 서버 진행도가 없을 때의 **다음 단계**. 답할 수 없으면 `null`(= 종전 목적지 그대로).
 *
 * 아이 id가 없으면 어떤 완료 표시가 있어도 `null`이다. ONB-003·ONB-004는 둘 다 저장에
 * `selectedChildId`를 요구하므로(두 화면의 `disabled`·`mutationFn` 가드), 아이 없이 그리로
 * 보내면 아무것도 누를 수 없는 화면에 사람을 세워 두게 된다.
 */
export function localOnboardingNextStep(facts: LocalOnboardingFacts): OnboardingNextStep | null {
  if (!facts.selectedChildId) return null;
  const highest = highestCompletedOnboardingStep(facts.completedStepIds);
  if (!highest) return null;
  return LOCAL_ONBOARDING_NEXT_STEP_BY_HIGHEST_COMPLETED[highest];
}

/**
 * 위 판정을 **화면 경로**로. 라우트는 `resume.ts`의 표에서 그대로 받는다(두 벌 금지).
 * `null`이면 호출부는 아무것도 하지 않고 종전 리다이렉트로 떨어진다.
 */
export function localOnboardingResumeRoute(facts: LocalOnboardingFacts): Href | null {
  const nextStep = localOnboardingNextStep(facts);
  return nextStep === null ? null : routeForOnboardingNextStep(nextStep);
}

/* ------------------------------------------------------------------------------------------ */
/* ONB-003의 로컬 탈출구 (계약 ⓑ)                                                              */
/* ------------------------------------------------------------------------------------------ */

/**
 * **ONB-003을 로컬로 통과할 수 있는가.**
 *
 * ## 왜 필요한가
 *
 * `app/(onboarding)/prepared-items.tsx`의 유일한 전진 경로는 서버 쓰기(`setPreparedItems`)였다.
 * 하나도 체크하지 않은 사람이 누르는 **"건너뛰고 계속"도 같은 뮤테이션**이라, 연결이 없으면
 * 0건을 보내지 못해 온보딩이 그 자리에서 멈췄다. 바로 다음 화면(ONB-004)은 반대다 — 그 화면의
 * 건너뛰기(`skip()`)는 순수 로컬이라 오프라인에서도 통과된다. 같은 온보딩 안에서 두 화면의
 * 규율이 달랐다.
 *
 * ## 왜 "체크 0건"에서만 열리는가 (부정 단언)
 *
 * **"0건을 보내지 못한 것"과 "12건을 보내지 못한 것"은 다른 실패다.** 체크한 항목은 서버에
 * 있어야 의미가 있는 사실이고(그 값으로 준비템 탭이 완료 표시를 그린다), 로컬로 통과시키면
 * 사용자가 방금 고른 12건이 **어디에도 남지 않은 채** 화면만 넘어간다. 그건 저장한 척하는
 * 것이라 이 저장소가 금지하는 종류의 거짓이다. 그래서 체크가 하나라도 있으면 이 길은 열리지
 * 않고, 그 사람에게 남는 것은 종전 그대로 [재시도]다.
 *
 * ## 왜 "저장 실패" 뒤에만 열리는가
 *
 * 처음부터 두 버튼을 나란히 세우면 서버가 멀쩡할 때도 사람들이 로컬 통과를 고르게 된다 —
 * 그러면 서버에 `preparedItemsSetAt`이 남지 않아 다음 실행의 이어하기가 이 화면으로 되돌아온다
 * (그 화면 주석이 적어 둔 그 이유). 이 길은 **서버가 실제로 답하지 않았을 때의 탈출구**다.
 */
export type PreparedItemsLocalPassInput = {
  /** 사용자가 지금 체크해 둔 항목 수. */
  checkedCount: number;
  /** 이 화면의 저장 뮤테이션이 실패한 상태인가(`save.isError`). */
  saveFailed: boolean;
};

export function canPassPreparedItemsLocally({ checkedCount, saveFailed }: PreparedItemsLocalPassInput): boolean {
  return saveFailed && checkedCount === 0;
}

/**
 * 그 탈출구 버튼의 라벨. ONB-004의 `"나중에 설정할게요"`와 **같은 문법**(1인칭 해요체)이고,
 * 같은 화면 하단 안내("나중에 준비템 탭에서 언제든 다시 체크할 수 있어요.")와 같은 동사를 쓴다 —
 * 버튼이 말하는 일과 실제로 일어나는 일이 한 자리에서 같다. 위쪽 기본 버튼의 `"건너뛰고 계속"`과
 * 글자가 다른 것은 의도다: 그 버튼은 **서버에 0건을 보내는** 길이고 이 버튼은 아니다.
 * DNC-018(해요체·비난 없음).
 */
export const PREPARED_ITEMS_LOCAL_PASS_LABEL = "나중에 체크할게요";

/* ------------------------------------------------------------------------------------------ */
/* ONB-002의 최후 방어 (계약 ⓓ)                                                                */
/* ------------------------------------------------------------------------------------------ */

/**
 * **이 기기가 이미 아이를 만들었는가.**
 *
 * 위 폴백이 서면 "ONB-002 성공 → 진행도 조회 실패 → 콜드 스타트"는 더 이상 ONB-001로 떨어지지
 * 않는다. 그래도 이 화면이 다시 열릴 길은 남는다(뒤로 가기, 딥링크). 그때 화면이 아무 말도 하지
 * 않으면 사용자는 자기가 어제 만든 아이를 모른 채 같은 태명을 한 번 더 적는다.
 *
 * **막지 않고 말한다.** 둘째 아이를 같은 이름으로 만드는 것은 정당할 수 있고(그 판정은 서버
 * 쪽이라 DNC-007에 닿는 별도 결정이다 — 이 트랙은 서버 0건이다), 앱이 대신 결정할 일이 아니다.
 * 그래서 사실 한 줄과 **이미 만든 아이로 이어가는 길**을 함께 준다. 폼도 [다음] 버튼도 그대로다.
 */
export function hasLocallyCreatedChild(facts: LocalOnboardingFacts): boolean {
  return Boolean(facts.selectedChildId) && facts.completedStepIds.includes("ONB-002");
}

/**
 * 그 사실 한 줄. 무엇이 있는지(이 기기에 등록된 아이)와 지금 이 화면을 그대로 진행하면 무슨
 * 일이 일어나는지(하나 더 생긴다)만 말한다 — "실수예요"·"하지 마세요" 같은 비난·지시형은 쓰지
 * 않는다(DNC-018). 아이 이름을 싣지 않는 것은 이 판정이 id만 알기 때문이다(없는 사실을 지어내지
 * 않는다).
 */
export const ONBOARDING_CHILD_ALREADY_CREATED_NOTICE =
  "이 기기에는 이미 등록한 아이가 있어요. 여기서 계속하면 아이가 하나 더 생겨요.";

/** 이미 만든 아이로 이어가는 버튼. 목적지는 위 목적지 표가 정한다(라우트를 손으로 적지 않는다). */
export const ONBOARDING_CHILD_ALREADY_CREATED_CONTINUE_LABEL = "등록한 아이로 계속하기";
