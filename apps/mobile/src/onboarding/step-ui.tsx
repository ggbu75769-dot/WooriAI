import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Platform, Text, View } from "react-native";
import { hasApiErrorCode } from "../api/api-error";
import { LOCAL_SESSION_TOKEN } from "../api/client";
import { trackAndFlushAnalyticsEvent } from "../analytics/client";
import { useAnalyticsConsentStore } from "../analytics/flag";
import { useSessionStore } from "../stores/session.store";
import { Card, SecondaryButton } from "../ui";
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
 * 이 저장 실패가 권한(403) 때문인가. 판정 기준은 서버 봉투의 코드 하나다
 * (src/api/api-error.ts -- 사람이 읽는 message 문구는 비교 기준으로 쓰지 않는다).
 */
export function isOnboardingSaveForbidden(error: unknown): boolean {
  return hasApiErrorCode(error, "FORBIDDEN");
}

/**
 * 저장 실패 -> 화면 문구. 아는 코드 둘만 갈라내고 나머지는 종전 문구 그대로다.
 * `CONSENT_REQUIRED`를 먼저 본다 — 둘 다 403이지만 이쪽이 더 구체적인 사실이다.
 */
export function onboardingSaveErrorMessage(error: unknown): string {
  if (isOnboardingConsentRequired(error)) return ONBOARDING_CONSENT_REQUIRED_MESSAGE;
  return isOnboardingSaveForbidden(error) ? ONBOARDING_SAVE_FORBIDDEN_MESSAGE : ONBOARDING_SAVE_FAILED_MESSAGE;
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
  const text = message ?? onboardingSaveErrorMessage(error);
  return (
    <View accessibilityRole="alert">
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
