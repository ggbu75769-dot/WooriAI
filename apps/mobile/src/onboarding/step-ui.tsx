import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Platform, Text, View } from "react-native";
import { hasApiErrorCode } from "../api/api-error";
// 라운드 78 A: 아는 코드는 표가 말한다. ⚠️ 같은 모듈인데 줄을 따로 두는 이유 — 윗줄은 라운드 60 #3의
// 소스 계약이 **바이트 그대로** 무는 자리다(src/onboarding-step-progress.test.ts: "판정은 서버 봉투의
// 코드 하나로 한다"). 한 줄로 합치면 이 트랙의 파일이 아닌 그 계약이 빨개진다.
import { apiErrorCodeOf, apiErrorMessageForCode } from "../api/api-error";
import { LOCAL_SESSION_TOKEN } from "../api/client";
import { trackAndFlushAnalyticsEvent } from "../analytics/client";
import { useAnalyticsConsentStore } from "../analytics/flag";
// 라운드 72 트랙 A(#1): 실패한 그 순간의 연결 상태. 폴 한 번이고 새 폴러를 돌리지 않는다.
// 라운드 72 리뷰 M-2: 그 배선은 저장소의 공용 한 벌이다(손으로 다시 적지 않는다).
import { useErrorTimeConnectivity } from "../offline/use-load-error-copy";
// 오프라인 문장은 이 앱의 **공용 단일 소스**를 글자 그대로 읽는다(새 문구 0건).
import { OFFLINE_RETRY_NOTICE } from "../offline/messages";
// 라운드 78 리뷰 M-2: 아이가 사라진 실패의 문장도 이 앱에 이미 한 벌 있다(새 문구 0건).
import { DESTRUCTIVE_FLOW_MESSAGE_BY_CODE } from "../settings/destructive-flow-messages";
import { useSessionStore } from "../stores/session.store";
import { announceForA11y, Card, SecondaryButton } from "../ui";
import { theme } from "../theme";
// 라운드 65 후속(#1): 동의 미저장 실패의 판정·문구·복구 규칙은 화면이 아니라 순수 모듈에 있다
// (react-native를 끌고 오지 않아 vitest에서 그대로 단위 테스트한다 -- consent-recovery.test.ts).
import {
  isOnboardingConsentRequired,
  ONBOARDING_CONSENT_REQUIRED_MESSAGE,
  ONBOARDING_CONSENT_RETRY_ACTION_LABEL
} from "./consent-recovery";
import { onboardingSteps, type OnboardingScreenId } from "./steps";

// ONB-105: shared step progress indicator for the four onboarding step screens.
// Derives the step number and total from src/onboarding/steps.ts (the pinned
// ONB-001..ONB-004 list) so the indicator can never drift from the real flow.
export function OnboardingStepProgress({ screenId }: { screenId: OnboardingScreenId }) {
  const stepIndex = onboardingSteps.findIndex((step) => step.screenId === screenId);
  const stepNumber = stepIndex + 1;
  const totalSteps = onboardingSteps.length;

  return (
    <View
      accessibilityLabel={`온보딩 ${totalSteps}단계 중 ${stepNumber}단계`}
      accessibilityRole="progressbar"
      style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.gap }}
    >
      <View style={{ flexDirection: "row", gap: 6 }}>
        {onboardingSteps.map((step, index) => {
          const isCurrent = index === stepIndex;
          const reached = index <= stepIndex;
          return (
            <View
              key={step.screenId}
              style={{
                backgroundColor: reached ? theme.colors.mainCoral : theme.colors.gray300,
                borderRadius: 4,
                height: 8,
                width: isCurrent ? 20 : 8
              }}
            />
          );
        })}
      </View>
      <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
        {stepNumber}/{totalSteps}
      </Text>
    </View>
  );
}

/** ONB-105: 다시 눌러 볼 만한 실패(네트워크·일시적 서버 오류)의 문구. */
export const ONBOARDING_SAVE_FAILED_MESSAGE = "저장하지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.";

/**
 * 라운드 60 #3: **권한이 없어서** 막힌 실패의 문구.
 *
 * 초대를 보기 전용(viewer)·선물 참여(gift_participant)로 수락한 사람이 온보딩에 들어오면,
 * ONB-002의 `POST /children`은 서버에서 403으로 막힌다
 * (apps/api/src/onboarding/children.controller.ts의 `@RequireHouseholdRoles("owner","co_parent")`).
 * 그런데 이 카드의 문구는 실패의 종류를 가리지 않고 언제나 "네트워크 연결을 확인한 뒤 다시
 * 시도해 주세요"였다 -- 연결과 무관한 실패에 연결을 확인하라 하고, 다시 눌러도 절대 풀리지
 * 않는 벽에 재시도를 권한 셈이다.
 *
 * 문구 규율은 초대 생성의 선례를 그대로 따른다(src/family/invite-permissions.ts의
 * INVITE_FORBIDDEN_MESSAGE): **재시도를 권하지 않고**, 실제로 통하는 다음 행동(관리자에게
 * 부탁하기)을 준다. 해요체.
 */
export const ONBOARDING_SAVE_FORBIDDEN_MESSAGE =
  "권한이 없어 저장하지 못했어요. 가족 관리자에게 아이 등록을 부탁해 주세요.";

/**
 * 라운드 78 리뷰 M-2 — **아이가 사라진 실패**의 문구. 아이 삭제 흐름이 쓰는 그 문장 그대로다
 * (src/settings/destructive-flow-messages.ts). 목적지를 가리키지 않고 지금 상태만 말하므로
 * 온보딩에서도 그대로 참이고, 재시도를 권하지도 않는다 — 이 화면에 없는 *"아이 목록"* 을
 * 가리키는 표의 문장 대신 여기 서는 이유가 그것이다(위 머리말).
 */
export const ONBOARDING_CHILD_GONE_MESSAGE = DESTRUCTIVE_FLOW_MESSAGE_BY_CODE.child_profile_delete.CHILD_NOT_FOUND;

/**
 * 이 저장 실패가 권한(403) 때문인가. 판정 기준은 서버 봉투의 코드 하나다
 * (src/api/api-error.ts -- 사람이 읽는 message 문구는 비교 기준으로 쓰지 않는다).
 */
export function isOnboardingSaveForbidden(error: unknown): boolean {
  return hasApiErrorCode(error, "FORBIDDEN");
}

/**
 * 저장 실패 -> 화면 문구. 아는 코드 둘만 갈라내고 나머지는 종전 문구 그대로다.
 * `CONSENT_REQUIRED`를 먼저 본다 — 둘 다 403이지만 이쪽이 더 구체적인 사실이다.
 *
 * ## 라운드 72 트랙 A(#1) — **연결을 확인하고 말한다**
 *
 * 이 문구는 실패의 종류를 가리지 않고 "네트워크 연결을 확인한 뒤 다시 시도해 주세요"라고 했고,
 * 온보딩 네 화면은 연결 상태를 **한 번도 확인하지 않았다**(라운드 72 정찰의 전수 grep:
 * `app/(onboarding)/**`·`src/onboarding/**`에서 `isCurrentlyOnline` 사용은 라운드 71 C가 넣은
 * `selected-child-recovery.ts` 한 곳뿐이었다). 라운드 52 C-07 이후 이 저장소의 규율은
 * **"확인하고 말한다"**인데 온보딩만 그 밖에 남아 있었다 — 게다가 그 문장은 지시형이라
 * 사용자에게 "당신이 확인하라"고 시킨다(DNC-018이 없애 온 어투다).
 *
 * ### 판정 순서 — 코드 → 오프라인 → 모르는 실패
 *
 * `destructive-flow-messages.ts`·`member-mutation-messages.ts`가 세운 순서 그대로다. 코드가
 * 먼저인 이유도 같다: **서버가 답을 줬다는 사실 자체**가 연결이 있었다는 뜻이라, 그 경우까지
 * 오프라인으로 말하면 그것이 또 하나의 틀린 안내가 된다.
 *
 * ### 바뀌지 않는 것
 *
 * `CONSENT_REQUIRED`·403·**온라인의 모르는 실패**는 종전과 **바이트 단위로 같다**. `isOnline`을
 * 넘기지 않은 호출부(기본값 true)도 종전 동작 그대로다 — 이 인자는 갈래를 하나 **더할** 뿐
 * 기존 셋 중 어느 것도 옮기지 않는다.
 *
 * ## 라운드 78 A(#1) — **아는 코드는 표가 말한다**
 *
 * 이 모듈이 아는 코드는 둘(`CONSENT_REQUIRED`·`FORBIDDEN`)뿐이었고 화이트리스트 표
 * (src/api/api-error.ts)를 **부르지 않았다.** 그래서 서버가 이유를 코드로 말해 준 실패까지
 * 전부 마지막 폴백 한 문장으로 접혔다 — 표에 **이미 있던** `CHILD_BIRTH_DATE_TOO_OLD`조차
 * 이 화면에는 구조적으로 설 수 없었다. 같은 실패가 아이 관리 화면
 * (app/settings/children.tsx → `useSaveErrorCopy` → `resolveSaveErrorCopy` → 표)에서는
 * *"20년보다 오래된 날은 고를 수 없어요."* 이고 온보딩에서는 *"저장하지 못했어요…"* 였다.
 * **한 여정의 두 화면이 같은 실패를 정반대로 말하던 자리**다(라운드 77 E가 초대 화면에서
 * 닫은 그 비대칭의 쌍둥이).
 *
 * ### 갈래는 다섯이다 — 전용 셋 → 표 → 오프라인 → 전용 폴백
 *
 * ⚠️ **라운드 78 리뷰 M-1이 순서를 뒤집었다.** 처음 이 갈래는 표를 오프라인 **뒤**에 두면서
 * *"오프라인으로 판정된 실패에는 서버 코드가 애초에 없다"* 를 근거로 적었는데, **그 근거는
 * 거짓이다**: `isOnline`은 실패 값에서 파생한 값이 아니라 카드가 마운트되는 순간 도는 **독립된
 * 폴 한 번**이다(`useErrorTimeConnectivity`). 서버가 400을 주고 그 직후 연결이 끊기면 —
 * 코드를 든 실패 값과 `isOnline: false`가 **동시에** 성립하고, 표 뒤 순서에서는 이유를 아는
 * 실패가 *"지금은 오프라인이에요"* 로 접힌다.
 *
 * 그래서 순서는 **코드 → 오프라인**이다. 근거는 이 저장소가 그 순서를 세울 때 적은 것과 같다:
 * **서버가 답을 줬다는 사실 자체**가 연결이 있었다는 뜻이다.
 *
 * **저장소의 순서 넷(2026-08-30 실측) — 표를 직접 보는 셋은 전부 코드가 먼저다.**
 *  - `resolveSaveErrorCopy`(src/offline/messages.ts): 표 → 오프라인 → 폴백.
 *  - `memberMutationErrorMessage`(src/family/member-mutation-messages.ts): 403 → 표 → 오프라인 → 폴백.
 *  - **이 함수**: 전용 셋 → 표 → 오프라인 → 폴백.
 *  - `inviteCreateErrorMessage`(src/family/invite-permissions.ts)만 403 → 오프라인 → 문장 → 폴백인데,
 *    그 자리는 **표를 직접 보지 않는다** — 이미 표를 지난 훅의 답(`serverCopy`)을 받으므로
 *    단위가 다르다. 이 계약이 무는 것은 앞의 셋이다.
 *
 * 전용 셋이 표보다 앞인 이유는 각각이다 — `FORBIDDEN`은 표에도 있지만 이 화면에서 사용자가
 * 알아야 할 사실은 중립 문구가 아니라 *"가족 관리자에게 부탁하라"* 이고, `CONSENT_REQUIRED`는
 * 문구가 아니라 **복구 동선**(`onReconsent`)이 답이라 표에 아예 넣지 않았다. 셋째는 라운드 78
 * 리뷰 M-2가 세웠다(바로 아래).
 *
 * ### `CHILD_NOT_FOUND` — 표의 문장이 **갈 곳 없는 안내**가 되는 자리 (리뷰 M-2)
 *
 * 표의 그 줄은 *"…아이 목록에서 확인해 주세요."* 로 끝난다. 아이 관리 화면에서는 옳지만
 * **온보딩에는 그 목적지가 없다**(탭도 목록도 아직 서지 않는다). 도달 경로는 실재한다: 공동
 * 양육자가 그사이 아이를 지우면 ONB-003·004의 저장이 `requireChildAccess`에서 404를 받는다
 * (apps/api/src/onboarding/child-access.service.ts).
 *
 * 그래서 이 코드만 표보다 앞에서 가로채고, 문장은 **이미 있던 것을 그대로 읽는다**(새 문구 0건 —
 * `DESTRUCTIVE_FLOW_MESSAGE_BY_CODE.child_profile_delete.CHILD_NOT_FOUND`). 그 문장은 목적지를
 * 가리키지 않고 지금 상태만 말하며, 재시도를 권하지도 않는다.
 *
 * ⚠️ `ITEM_NOT_FOUND`("준비템 탭에서 확인해 주세요")는 **같은 병이 아니다** — 온보딩의 저장 셋은
 * 그 코드를 던지는 파일(items-catalog.service.ts)을 지나지 않는다. ONB-003의 저장은 없는
 * 템플릿 id를 조용히 걸러 낼 뿐 404를 만들지 않는다(onboarding-core.service.ts의
 * `setPreparedItems`). 갈래를 세우지 않는 근거를 값으로 적어 두는 것이 여기서 할 수 있는 전부다
 * (그 사실은 api-error.test.ts의 여정 스윕이 함께 문다).
 *
 * ### ⚠️ 이 갈래의 값은 오늘 좁다 — 표가 자라는 날을 위한 자리다 (리뷰 M-3)
 *
 * 정직하게 적는다: **오늘 이 화면에서 표를 지나 실제로 서는 코드는 0건**이다. 날짜 셋
 * (`CHILD_BIRTH_DATE_FUTURE`·`CHILD_DUE_DATE_BEYOND_TERM`·`CHILD_BIRTH_DATE_TOO_OLD`)은 같은 폼
 * 모듈(`src/children/child-form.ts`의 `computeDateError`)이 저장 **전에** 막고,
 * `CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED`를 내는 전환 카드는 **설정 > 아이 프로필에만** 있으며,
 * `FORBIDDEN`·`CONSENT_REQUIRED`·`CHILD_NOT_FOUND`는 전용 셋이 먼저 답한다. 그래도 이 갈래가 서는
 * 이유는 라운드 77 트랙 E가 초대 화면에서 적어 둔 것과 같다 — **종전 구조에서는 앱 전역 표가
 * 자라도 이 화면만 일반 폴백을 말했고, 그 파생은 아무 단언도 깨지 않았다.** 아이 저장 경로에
 * 서버 코드가 하나 느는 날 이 자리가 값을 낸다(실기기 확인은
 * docs/qa/runtime-verification-required.md의 124번 행 ⓕ — ⚠️ 이 파일의 픽셀락 계약이 `#` + 숫자를
 * 색상 리터럴로 읽으므로 행 번호를 그 모양으로 적지 않는다).
 *
 * 그래서 이 라운드가 실제로 바꾸는 것은 **표가 아는 코드**와 그 순서뿐이고, 그것이 이 갈래의
 * 목적이다.
 */
export function onboardingSaveErrorMessage(error: unknown, { isOnline = true }: { isOnline?: boolean } = {}): string {
  if (isOnboardingConsentRequired(error)) return ONBOARDING_CONSENT_REQUIRED_MESSAGE;
  if (isOnboardingSaveForbidden(error)) return ONBOARDING_SAVE_FORBIDDEN_MESSAGE;
  // 라운드 78 리뷰 M-2: 표의 문장이 이 화면에 없는 목적지를 가리키는 유일한 코드(위 머리말).
  if (hasApiErrorCode(error, "CHILD_NOT_FOUND")) return ONBOARDING_CHILD_GONE_MESSAGE;
  // 라운드 78 A: 서버가 코드로 말해 준 실패는 표가 답한다(문구를 이 파일에 다시 적지 않는다).
  // 모르는 코드면 표가 null을 돌려주고, 그 아랫줄의 두 문장은 종전과 바이트 단위로 같다.
  const knownByCode = apiErrorMessageForCode(apiErrorCodeOf(error));
  if (knownByCode) return knownByCode;
  // 오프라인 갈래. 문장은 공용 단일 소스에서 글자 그대로 온다 -- 같은 상황을 화면마다 다른 말로
  // 부르지 않기 위해서다(src/offline/messages.ts의 OFFLINE_RETRY_NOTICE 머리말). 카드의 버튼이
  // "재시도"이므로 그 문장의 "다시 시도해 주세요"와 동사가 맞는다.
  if (!isOnline) return OFFLINE_RETRY_NOTICE;
  return ONBOARDING_SAVE_FAILED_MESSAGE;
}

/**
 * 라운드 72 트랙 A(#1) — 실패 시점 연결 판정의 **배선**.
 *
 * **데모 세션은 폴을 돌리지 않는다.** 로컬 백엔드는 네트워크를 지나지 않으므로(client.ts의
 * isLocalToken 분기) 그 실패는 연결과 무관하다 — 그 자리에서 "지금은 오프라인이에요"라고 말하면
 * 그것 자체가 틀린 사실이다(privacy.tsx가 같은 이유로 같은 예외를 둔다).
 *
 * ## 라운드 72 리뷰 M-2 — 폴 배선을 손으로 적지 않는다
 *
 * 종전에는 이 자리에 `useState` + `isCurrentlyOnline().then(setIsOnline)` + cancelled 가드가
 * **손으로 다시 적혀** 있었다. 라운드 72 트랙 E가 그 사본들을 세는 스윕을 세울 때 이 자리를
 * 놓친 이유는 스윕이 `.then(set…)` **한 형태만** 봤기 때문이다 — 여기와 privacy 화면은
 * `.then((online) => { … })` 꼴이라 그물을 그대로 빠져나갔다(그 스윕은 이제 호출 자리 단위로
 * 넓혀졌다: `src/shared-decision-wiring.test.ts` ⓐ-1).
 *
 * 그래서 판정 배선은 공용 한 벌(`useErrorTimeConnectivity`)이 지고, 이 훅에 남는 것은 **데모
 * 세션 갈래 하나**다. 종전과 동작이 동치인 근거: 넘기는 값 `!isDemoSession`은 종전 effect의
 * 가드 `!isError || isDemoSession`을 뒤집은 것과 같고(이 훅이 마운트되는 순간이 곧 실패
 * 시점이라 `isError`는 언제나 true다 — 아래 카드의 주석), 공용 훅도 인자가 false면 `true`로
 * 복원하고 폴을 띄우지 않는다. 훅은 **조건 없이** 호출되므로 hooks 규칙에도 안전하다.
 */
export function useOnboardingSaveFailureConnectivity(): boolean {
  const isDemoSession = useSessionStore((state) => !state.accessToken && state.isTestSession);
  const isOnline = useErrorTimeConnectivity(!isDemoSession);

  return isDemoSession || isOnline;
}

// ONB-105: consistent inline save-failure card with an explicit 재시도 affordance.
// Rendered by the onboarding steps that persist to the server (ONB-002/003/004)
// when their save mutation fails (e.g. network error), instead of a passive toast.
//
// 라운드 60 #3: `error`를 받으면 문구가 실패 종류에 따라 갈리고, 403일 때는 [재시도] 버튼
// 자체를 내린다 -- 다시 눌러도 결과가 같은 자리에 버튼을 두는 것이 무한 재시도의 입구였다.
//
// 라운드 65 후속(#1): `CONSENT_REQUIRED`에는 **전용 버튼**이 선다(`onReconsent`). 그냥 [재시도]는
// 같은 저장을 다시 보낼 뿐이라 결과가 같고, 이 실패를 푸는 유일한 행동은 동의를 서버에 다시
// 올리는 것이기 때문이다. 배선이 없는 화면(`onReconsent` 미전달)에서는 종전대로 [재시도]가
// 서고, 그때도 문구만큼은 사실을 말한다 — 버튼이 없다고 거짓 문구로 되돌아가지는 않는다.
export function OnboardingSaveErrorCard({
  error,
  message,
  onReconsent,
  onRetry
}: {
  error?: unknown;
  message?: string;
  /** CONSENT_REQUIRED 복구: 동의를 다시 올린 뒤 원래 저장을 1회 재시도하는 핸들러. */
  onReconsent?: () => void;
  onRetry: () => void;
}) {
  const forbidden = isOnboardingSaveForbidden(error);
  const consentRequired = isOnboardingConsentRequired(error);
  // 라운드 72 트랙 A(#1): 이 카드는 실패했을 때만 그려지므로(세 화면 모두 `save.isError ?`)
  // 마운트되는 순간이 곧 실패 시점이고, 그때 폴이 한 번 돈다.
  // 라운드 72 리뷰 S-1: 그래서 종전의 `isError` 인자는 **언제나 리터럴 `true`**였다 —
  // 갈래를 만들지 않는 인자는 판정이 하나 더 있는 척하는 것이라 시그니처에서 걷어냈다.
  const isOnline = useOnboardingSaveFailureConnectivity();
  const text = message ?? onboardingSaveErrorMessage(error, { isOnline });
  // 라운드 87 트랙 C: **프롭 둘은 한 플랫폼의 답이다.** `accessibilityLiveRegion`은 React Native
  // 문서가 `@platform android`로 표시한 프롭이고 `accessibilityRole="alert"`에는 VoiceOver의
  // 대응 트레이트가 없다 — 그래서 라운드 79가 이 카드에 프롭 둘을 걸어 둔 뒤에도 **iOS에서는
  // 아무 소리도 나지 않았다**(낭독 스윕 둘이 라우트 뿌리만 걷느라 모듈 층의 이 자리를 구조적으로
  // 보지 못했다 — src/a11y-contract.test.ts의 모듈 층 뿌리가 오늘 그 사각을 값으로 연다).
  // 관례는 언제나 **둘 다**이고(프롭 조합 + `announceForA11y`), 본보기는 같은 저장소에 있다:
  // app/(auth)/login.tsx가 같은 이유(포커스가 눌린 버튼에 남는다)로 실패 문장에 그것을 건다.
  //
  // ⚠️ 읽는 것은 **화면에 이미 그려진 그 문자열**(`text`)이다 — 문구를 여기 두 벌로 적지 않는다.
  // ⚠️ 렌더 도중이 아니라 effect 안이고, 의존 배열이 그 문장을 든다: 카드가 서는 순간 한 번
  // 읽고 같은 문장을 매 렌더 다시 읽지 않으며, 사유가 갈린 두 번째 실패(예: 네트워크 → 403)는
  // `text`가 바뀌므로 조용해지지 않는다.
  useEffect(() => {
    announceForA11y(text);
  }, [text]);
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Card style={{ borderColor: theme.colors.danger, borderWidth: 1, gap: theme.spacing.gap }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
          {/* D1 후속(실기기 피드백 2) 마무리: 마지막까지 남아 있던 텍스트 글리프(⚠)를 다른
              화면과 같은 Ionicons로 바꾼다 -- 글리프는 기기 폰트에 따라 네모(tofu)로 떨어져,
              하필 "저장하지 못했어요" 카드에서 깨진 글자로 보였다. 아이콘은 장식이다: 카드는
              accessibilityRole="alert"이고 바로 옆 Text가 사실을 말한다. */}
          <Ionicons
            accessible={false}
            name="warning"
            size={theme.typography.body1.fontSize}
            color={theme.colors.danger}
          />
          <Text style={{ color: theme.colors.brown, flex: 1, fontSize: theme.typography.body2.fontSize }}>{text}</Text>
        </View>
        {consentRequired && onReconsent ? (
          <SecondaryButton
            accessibilityLabel={ONBOARDING_CONSENT_RETRY_ACTION_LABEL}
            label={ONBOARDING_CONSENT_RETRY_ACTION_LABEL}
            onPress={onReconsent}
          />
        ) : forbidden ? null : (
          <SecondaryButton accessibilityLabel="저장 재시도" label="재시도" onPress={onRetry} />
        )}
      </Card>
    </View>
  );
}

/**
 * 라운드 60 #9: 온보딩 **단계 진입** 계측(`onboarding_step_viewed`).
 *
 * 지금까지 온보딩 관련 이벤트는 `onboarding_completed` 하나뿐이었다 -- 어드민 KPI 퍼널의
 * 1단이 이미 "완료"라서, 그 앞에서 몇 명이 어디서 그만뒀는지는 어떤 데이터로도 답할 수 없었다.
 *
 * 페이로드는 **단계 enum + 정수**뿐이다(packages/contracts/src/analytics.ts의 PII 규칙 --
 * 문자열 필드는 enum만 허용되고 analytics.pii-lint가 이를 강제한다). 아이 애칭·예정일·금액은
 * 이 화면들에 다 있지만 하나도 싣지 않는다.
 *
 * 중복 억제는 app/index.tsx의 app_opened, app/items/[itemTemplateId].tsx의 item_detail_viewed와
 * 같은 **모듈 레벨 Set** 관례다: 한 실행 안에서 같은 단계는 한 번만 센다(뒤로 갔다 오는 것은
 * 새로운 진입이 아니다). 동의 게이트를 **먼저** 본 뒤 실제로 발사한 경우에만 Set에 넣는다
 * (라운드 27 L-3: 동의 OFF로 지나친 단계가 이후 동의를 켜도 영영 미발사로 남지 않게).
 *
 * 라운드 69 E(#5): 이 Set을 비우는 `__reset…ForTests`가 여섯 라운드 동안 **참조 0건**으로 있다가
 * 지워졌다 — 부르는 테스트가 없는 리셋 함수는 "테스트가 이 상태를 초기화한다"는 거짓말이었다.
 * 실제 계약은 그대로다: 이 Set은 **한 실행 안에서만** 산다(모듈 레벨 = 앱 실행 단위).
 */
const trackedOnboardingStepsThisLaunch = new Set<OnboardingScreenId>();

/** 계약 레지스트리 ONBOARDING_STEPS의 미러 -- 화면 코드(ONB-00N)가 아니라 단계 이름을 보낸다. */
export const ONBOARDING_STEP_ANALYTICS_IDS: Readonly<Record<OnboardingScreenId, string>> = {
  "ONB-001": "child_status",
  "ONB-002": "child_profile",
  "ONB-003": "prepared_items",
  "ONB-004": "budget"
};

/** onboarding_step_viewed v1 페이로드 -- 단계 enum + 1부터 세는 단계 번호, 그뿐이다. */
export function buildOnboardingStepViewedPayload(screenId: OnboardingScreenId): {
  step: string;
  stepNumber: number;
} {
  const stepIndex = onboardingSteps.findIndex((step) => step.screenId === screenId);
  return {
    step: ONBOARDING_STEP_ANALYTICS_IDS[screenId],
    // 진행 표시와 같은 단일 소스(steps.ts)에서 센다 -- 표시가 "2/4"인데 계측이 3단이면 안 된다.
    stepNumber: stepIndex + 1
  };
}

/** 네 온보딩 화면이 한 줄로 부르는 계측 훅. 발화 관례(동의 게이트·플랫폼)는 여기 한 곳에 있다. */
export function useOnboardingStepAnalytics(screenId: OnboardingScreenId): void {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const analyticsConsent = useAnalyticsConsentStore((state) => state.enabled);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);

  useEffect(() => {
    if (!analyticsConsent) return;
    if (trackedOnboardingStepsThisLaunch.has(screenId)) return;
    trackAndFlushAnalyticsEvent(authToken, {
      eventName: "onboarding_step_viewed",
      payload: buildOnboardingStepViewedPayload(screenId),
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
    });
    trackedOnboardingStepsThisLaunch.add(screenId);
  }, [analyticsConsent, authToken, screenId]);
}
