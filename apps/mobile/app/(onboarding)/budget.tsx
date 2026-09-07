import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Platform, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
// A11Y-115(라운드 108-T20 이월 · 과제 1): 검증 오류의 낭독 규율은 한 벌이 소유한다
// (재낭독 금지 · 갈래가 닫히면 기억을 지운다 — src/a11y/use-field-error-announcement.ts).
import { useFieldErrorAnnouncement } from "../../src/a11y/use-field-error-announcement";
import { LOCAL_SESSION_TOKEN, upsertBudget } from "../../src/api/client";
import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";
import {
  OnboardingSaveErrorCard,
  OnboardingStepProgress,
  useOnboardingStepAnalytics
} from "../../src/onboarding/step-ui";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { amountDigitsOnly, formatAmountDigits } from "../../src/money";
// GAP-054 #2: 상한 값·문구는 예산 수정·지출 입력 화면과 **같은 모듈**이 단일 소스다.
import { amountOverLimitMessage, isAmountOverLimit } from "../../src/expenses/amount-limit";
import { AppScreen, Card, PrimaryButton, ScreenHeader, TextButton } from "../../src/ui";
import { theme } from "../../src/theme";

// FMT-127: 금액 표기(콤마)·입력 정규화는 src/money.ts가 단일 소스다 -- 이 화면에 있던
// toDigits/formatAmount 사본은 (예산 수정·지출 수정 화면의 같은 사본들과 함께) 제거했다.

export default function BudgetScreen() {
  /**
   * 라운드 108(온보딩 나가는 길) — ⚠️ 두 시점: 종전 이 줄은 `useState("500000")`이었다.
   *
   * 그때도 그 값이 **저장되는 진짜 값**이긴 했다(허위 표시가 아니다 — 홈이 그리는 숫자는 실제로
   * 저장된 예산이다). 문제는 다른 것이다: CTA가 "예산 저장하고 시작하기"라, 한 글자도 치지 않고
   * 한 번 누르면 **자기가 정한 적 없는 50만원**이 저장되고 그 뒤로 홈 진행바·예산 경고·리포트의
   * "예산의 N%"가 전부 그 수를 분모로 쓴다. 자기 예산이 200만원인 사람은 둘째 주에 근거 없는
   * "예산을 넘겼어요"를 받는다.
   *
   * 이 판단은 이 트랙이 새로 짓지 않았다 — **이 저장소가 이미 두 번 내린 결정**을 마지막
   * 한 자리에 적용할 뿐이다:
   *  ① 바로 앞 걸음 ONB-002는 태명이 "튼튼이"로 미리 채워져 있던 자리를 빈 칸 + placeholder로
   *     바꿨다("아무것도 입력하지 않아도 남의 이름으로 아이가 만들어졌다" — 실기기 피드백 1,
   *     app/(onboarding)/child-profile.tsx의 그 주석). 같은 결함의 같은 모양이다.
   *  ② 같은 값을 나중에 고치는 화면(app/budget.tsx)은 이미 `useState("")` + placeholder로 선다.
   *  ③ `formatAmountDigits`는 빈 문자열을 빈 문자열로 돌려주도록 **일부러** 만들어져 있다
   *     ("so the field's placeholder keeps showing" — src/money.ts). 이 꼴이 지원되는 모양이다.
   *
   * 빈 값으로 시작해도 새 갈래가 생기지 않는다: "예산 미설정"은 바로 아래 [나중에 설정할게요]가
   * 이미 만드는 상태이고, 홈은 그 상태를 진행바 대신 예산 설정 넛지로 받는다
   * (src/home/budget-progress.ts · budget-pace.ts). 첫 렌더의 기본 버튼은 비활성으로 시작하는데,
   * 그것도 ONB-002가 같은 이유로 이미 고른 모양이다("저장 버튼은 어차피 비활성이라 진행을 잘못
   * 허용할 위험도 없다"). 50만원은 사라지지 않고 **제안**의 자리로 내려간다 — placeholder다.
   */
  const [amountDigits, setAmountDigits] = useState("");
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  const markHomeReached = useOnboardingProgressStore((state) => state.markHomeReached);

  // 라운드 60 #9: 단계 진입 계측(onboarding_step_viewed). 동의 OFF면 완전한 no-op이다.
  useOnboardingStepAnalytics("ONB-004");

  const amountKrw = Number(amountDigits || "0");
  /**
   * GAP-054 #2 — 예산 수정 화면(app/budget.tsx)과 **같은 판정·같은 문구**다. `budgets.amount_krw`
   * (int4) 상한을 넘긴 값은 서버가 400으로 거절하므로(UpsertBudgetDto의 @Max), 온보딩 마지막
   * 단계에서 저장이 실패해 사용자가 막히는 일이 없게 입력 칸이 먼저 말한다. 기본값(500,000)은
   * 상한 아래라 이 화면의 첫 렌더는 한 픽셀도 바뀌지 않는다.
   *
   * ⚠️ 라운드 108 — 위 마지막 문장은 **그때는 참이었다**(기본값이 50만원이던 시점의 사실이라
   * 지우지 않는다). 오늘 기본값은 빈 문자열이라(위 `useState` 주석) 첫 렌더에서 이 판정이 보는
   * 값은 0이고, `amountDigits.length > 0` 가드 때문에 **오류 문구는 여전히 뜨지 않는다** —
   * 아무것도 치지 않은 사람을 첫 화면에서 꾸짖지 않는다는 규율은 그대로다(ONB-002의 같은 가드).
   * 바뀐 것은 하나: 기본 버튼이 `amountKrw > 0` 때문에 **비활성으로 시작한다.**
   */
  const amountError =
    amountDigits.length > 0 && amountKrw <= 0
      ? "0보다 큰 금액을 입력해 주세요."
      : isAmountOverLimit(amountKrw)
        ? amountOverLimitMessage()
        : null;
  /**
   * A11Y-115(라운드 108-T20 이월) ⚠️ **두 시점** — *종전*: 이 오류 한 줄에는 낭독 출구가 없었다
   * (그때는 참이었다 — 라운드 79·80의 낭독 스윕은 `useMutation`/`useQuery`에 닿는 조건 아래 선
   * 실패 문장만 모집단으로 삼는데, 이 줄의 가드는 입력칸 상태에서 파생한 순수 계산이라 그 그물
   * **밖**이다). *이제*: 나중에 같은 값을 고치는 화면(app/budget.tsx)이 T20에서 세운 그 한 벌을
   * 그대로 진다 — 문장 쪽에는 프롭 둘, 낭독은 이 훅이 소유한다. 같은 상한을 같은 모듈에서 읽어
   * (`src/expenses/amount-limit.ts`) **같은 문장**을 말하는 두 화면이 서로 다르게 들리지 않는다.
   * **새 한국어 문장 0건.**
   *
   * ⚠️ 여기에는 touched 게이트가 필요 없다 — `amountError` 자신이 `amountDigits.length > 0`을
   * 이미 지고 있어(위 주석) 아무것도 치지 않은 첫 렌더에서는 null이다. 즉 훅에 넘기는 값이
   * 화면이 그 줄을 그리는 조건과 글자 그대로 같다(온보딩 아이 프로필 셋과 갈리는 유일한 점).
   * 훅이므로 조건 밖에서 부른다(FIX-A).
   */
  useFieldErrorAnnouncement(amountError);
  const canSave = !amountError && amountKrw > 0 && Boolean(authToken && selectedChildId);

  // ANA-101 (round5a-sprint2-plan.md §5): the last onboarding step reaching
  // /(tabs) -- via either a saved budget or an explicit skip -- is the single
  // "onboarding completed" moment. trackAndFlushAnalyticsEvent is a no-op
  // while analytics opt-in is OFF (its default), so this has no effect until
  // ANA-102 turns consent on.
  function trackOnboardingCompleted() {
    const stepCount = useOnboardingProgressStore.getState().completedStepIds.length;
    trackAndFlushAnalyticsEvent(authToken, {
      eventName: "onboarding_completed",
      payload: { stepCount },
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
    });
  }

  const save = useMutation({
    mutationFn: () => {
      // GAP-054 #2: 버튼 비활성과 같은 판정을 저장 직전에도 본다(서버 @Max와 같은 숫자).
      if (
        !authToken ||
        !selectedChildId ||
        !Number.isInteger(amountKrw) ||
        amountKrw <= 0 ||
        isAmountOverLimit(amountKrw)
      ) {
        throw new Error("invalid budget");
      }
      return upsertBudget(authToken, selectedChildId, amountKrw);
    },
    onSuccess: () => {
      completeStep("ONB-004");
      markHomeReached();
      trackOnboardingCompleted();
      router.replace("/(tabs)");
    }
  });

  function skip() {
    completeStep("ONB-004");
    markHomeReached();
    trackOnboardingCompleted();
    router.replace("/(tabs)");
  }

  return (
    <AppScreen>
      <View testID="screen-ONB-004" style={{ gap: theme.spacing.section }}>
        <OnboardingStepProgress screenId="ONB-004" />
        {/* UX-G: 마지막 단계의 부제가 온보딩 다음에 올 **첫 행동**(홈에서의 첫 지출 기록)을
            미리 알려 준다 -- 홈의 첫 지출 유도 카드(src/home/first-run-guide.ts)와 이어지는
            한 문장이라, 예산을 건너뛴 사용자도 빈 홈 앞에서 "이제 뭘 하지?"로 멈추지 않는다.
            흐름·구조는 그대로이고 문구만 다듬었다.
            라운드 96 T5 — ⚠️ 두 시점: 종전 부제는 "나중에 예산 화면에서 언제든 바꿀 수 있어요.
            이제 홈에서 첫 지출만 기록하면 준비 끝이에요."였다. "나중에 … 언제든"의 겹말과 군더더기
            접속("이제")을 걷는다 — 무엇을 어디서 바꾸는지는 바로 아래 월별 안내 줄("매달 초에
            홈에서 이어서 설정할 수 있어요")이 이미 말한다. 제목의 붙여 쓴 방언("정해주세요")도
            다수파(띄어 쓴 꼴)로 맞춘다. */}
        <ScreenHeader
          eyebrow="마지막 단계"
          title="한 달 예산을 정해 주세요"
          subtitle="언제든 바꿀 수 있어요. 홈에서 첫 지출만 기록하면 준비 끝이에요."
        />
        {/* 라운드 48 B1(d): 예산은 (아이, 연월) 단위로 저장되고 **이월되지 않는다**. 그래서 매달
            1일이면 홈의 진행바·경고가 함께 조용해지는데, 지금까지 온보딩은 그 사실을 한 번도
            말하지 않아 사용자는 "예산이 사라졌다 = 고장"으로 읽을 수밖에 없었다. 여기서 미리
            한 줄로 밝힌다 -- 재촉이나 숙제가 아니라 사실 고지이고, 홈의 넛지가 매달 초에 지난달
            값을 알려 주며 이어 받는다(app/(tabs)/index.tsx의 B1(c)). */}
        <Text
          testID="onboarding-budget-monthly-notice"
          style={{
            color: theme.colors.gray600,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: 18
          }}
        >
          예산은 달마다 따로 설정해요 — 매달 초에 홈에서 이어서 설정할 수 있어요.
        </Text>

        <Card style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
            월 예산
          </Text>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <TextInput
              accessibilityLabel="월 예산 입력"
              keyboardType="number-pad"
              returnKeyType="done"
              onChangeText={(value) => setAmountDigits(amountDigitsOnly(value))}
              // 라운드 108: 종전의 기본값 50만원이 내려앉은 자리. 예시는 placeholder로만 보여
              // 준다 — ONB-002의 "예) 튼튼이"와 같은 문법이다(그 화면의 실기기 피드백 1 주석).
              placeholder="예) 500,000"
              style={{
                color: theme.colors.brown,
                fontSize: 24,
                fontWeight: "800",
                paddingVertical: 6
              }}
              value={formatAmountDigits(amountDigits)}
            />
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>원</Text>
          </View>
          {amountError ? (
            /* A11Y-115(라운드 108-T20 이월): 프롭 조합·순서는 **예산 수정 화면의 총액 오류 줄과
               같다**(app/budget.tsx — 같은 모듈이 만든 같은 문장이므로 모양도 같아야 한다).
               맨 문장에 거는 관례의 기본형이다: 이 여는 태그를 붙드는 소유 밖 바이트 핀이 없다
               (지출 수정 화면 넷이 컨테이너를 고른 사정 — `auto-fill-wiring.test.ts`의 색 계약 —
               은 이 파일에 없다). */
            <Text
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}
            >
              {amountError}
            </Text>
          ) : null}
        </Card>

        {save.isError ? <OnboardingSaveErrorCard error={save.error} onRetry={() => save.mutate()} /> : null}

        <View style={{ gap: theme.spacing.gap }}>
          <PrimaryButton
            disabled={!canSave || save.isPending}
            label={save.isPending ? "저장하는 중" : "예산 저장하고 시작하기"}
            onPress={() => save.mutate()}
          />
          <TextButton disabled={save.isPending} label="나중에 설정할게요" onPress={skip} style={{ alignSelf: "center" }} />
        </View>
      </View>
    </AppScreen>
  );
}
