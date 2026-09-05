import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSeoulToday } from "@wooriai/domain";
import { Redirect, router } from "expo-router";
import { Text, View } from "react-native";
import { LOCAL_SESSION_TOKEN, upsertConsents, type Child } from "../../src/api/client";
// GAP-062 #6(P3): 단계 라벨을 사람에게 보여 주는 자리는 전부 같은 표시층 판정을 지난다
// (재사용만 — 판정은 src/home/stage-display-label.ts 한 자리에 있다).
import { resolveStageDisplayLabel } from "../../src/home/stage-display-label";
import { formatKrw } from "../../src/money";
import { routeForOnboardingNextStep } from "../../src/onboarding/resume";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useOnboardingResumeStore } from "../../src/stores/onboarding-resume.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, PrimaryButton, ScreenHeader, SecondaryButton } from "../../src/ui";
import { theme } from "../../src/theme";

const nextStepLabels: Record<string, string> = {
  consents: "약관 동의",
  "child-profile": "아이 프로필 입력",
  "prepared-items": "이미 준비한 물건 체크",
  budget: "월 예산 설정"
};

export default function OnboardingResumeScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  /**
   * 라운드 51 #2: 데모 세션도 이 화면에 도달한다(app/index.tsx의 진행도 조회가 더 이상
   * 테스트 세션을 건너뛰지 않는다). 저장소의 다른 화면과 같은 관례로 토큰을 고른다.
   */
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const queryClient = useQueryClient();
  const progress = useOnboardingResumeStore((state) => state.progress);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  const resetOnboarding = useOnboardingProgressStore((state) => state.resetOnboarding);

  // If this screen is reached without a freshly fetched progress (e.g. a deep link, or a
  // reloaded JS bundle that cleared the in-memory resume store), fall back to "/" so index.tsx
  // re-fetches server progress instead of showing a blank/guessed resume state.
  useEffect(() => {
    if (!progress) {
      router.replace("/");
    }
  }, [progress]);

  if (!progress) {
    return <Redirect href="/" />;
  }

  const { summary, nextStep, canRestart } = progress;
  const stepLabel = nextStepLabels[nextStep] ?? "다음 단계";
  /**
   * GAP-062 #6(P3) — 이어하기 카드의 단계 라벨.
   *
   * 도달 빈도는 낮지만 원인은 더보기 탭·홈 헤더와 **같은 하나**다: 예정일이 유예를 넘겨
   * 지났는데 출생 전환을 하지 않은 프로필에서 서버 라벨이 "임신 42주차"에 고착된다. 여기서만
   * 그 문장이 남으면 같은 아이를 두고 화면마다 다른 말을 하게 되므로 같은 함수를 지난다.
   *
   * 진행도 응답(`OnboardingChildSummary`)은 `stageMode`는 싣지만 `dueDate`는 싣지 않는다.
   * 그래서 날짜는 `["children"]` 캐시에서 **읽기만** 한다(`useQuery`가 아니라 `getQueryData` —
   * 이 화면 때문에 새 요청이 나가지 않는다). 이어하기 화면은 온보딩 초입이라 그 캐시가 아직
   * 비어 있는 경우가 흔한데, 그때는 판정이 서버 라벨을 **그대로** 돌려준다 — 모르는 날짜를
   * 근거로 문장을 바꾸지 않는다(모르면 말하지 않는다).
   */
  const resumeChild = summary.child;
  const cachedResumeChild = resumeChild
    ? queryClient.getQueryData<{ children: Child[] }>(["children"])?.children.find((child) => child.id === resumeChild.id)
    : undefined;
  const resumeStageLabel = resumeChild
    ? resolveStageDisplayLabel({
        stageMode: cachedResumeChild?.stageMode ?? resumeChild.stageMode,
        dueDate: cachedResumeChild?.dueDate,
        todayIso: getSeoulToday(),
        stageLabel: resumeChild.stageLabel
      })
    : "";

  function resume() {
    if (!progress) return;
    if (summary.child) {
      setSelectedChildId(summary.child.id);
      completeStep("ONB-001");
      completeStep("ONB-002");
    }
    if (summary.preparedItemsCount !== null) {
      completeStep("ONB-003");
    }
    if (nextStep === "consents" && authToken) {
      // Defensive resubmission: consents are stored as an idempotent upsert server-side, so
      // resending them here is always safe -- this only matters if a previous login's
      // upsertConsents call was lost to a network error after oauth-login already succeeded.
      // 데모 세션도 같은 재제출을 탄다(로컬 백엔드의 upsertConsents 역시 멱등이다).
      void upsertConsents(authToken).catch(() => undefined);
    }
    router.replace(routeForOnboardingNextStep(nextStep));
  }

  function restartFromScratch() {
    resetOnboarding();
    router.replace("/onboarding/child-status");
  }

  return (
    <AppScreen>
      <View testID="screen-ONB-006" style={{ gap: theme.spacing.section }}>
        {/* 라운드 99 트랙 F1(L) — ⚠️ 두 시점: 종전 부제는 `지난번에는 "${stepLabel}" 단계까지
            진행했어요.`였다. 그런데 stepLabel은 nextStep — **아직 가지 않은** 단계다(위
            nextStepLabels). "아이 프로필 입력"이 다음인 사람은 아이 프로필을 입력한 적이
            없는데, 종전 문장은 그 단계까지 **진행했다**고 과장했다 — hasResumeWorthyProgress
            (src/onboarding/resume.ts)가 이어하기 게이트를 세울 때 정확히 이 문장을 들어
            "사실이 아닌 말"이라 적었던 그 결함이, 게이트를 지나 온 사람에게도 한 단계
            어긋난 채 남아 있던 것이다. 그래서 과거를 단정하지 않고 지금 갈 곳만 말한다
            (DNC-018 해요체 — 사실만, 지시·과장 없이). */}
        <ScreenHeader
          eyebrow="이어서 진행하기"
          title="하던 곳부터 계속할까요?"
          subtitle={`이번에는 "${stepLabel}"부터 이어가요.`}
        />

        <Card style={{ gap: 10 }}>
          {resumeChild ? (
            <Text style={{ color: theme.colors.brown, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
              {resumeChild.nickname} · {resumeStageLabel}
            </Text>
          ) : null}
          {summary.preparedItemsCount !== null ? (
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
              {/* 라운드 45 UX-Y: ONB-003의 기본값이 "전체 선택"에서 "전체 해제"로 바뀌어 0개는
                  흔하고 정상인 결과가 됐다("건너뛰고 계속"도 0개다). 그 상태를 "0개 저장됨"이라고
                  적으면 저장이 실패한 것처럼 읽히므로, 0일 때만 사실 그대로 다시 쓴다. */}
              {summary.preparedItemsCount > 0
                ? `준비물 체크 ${summary.preparedItemsCount}개 저장됨`
                : "체크한 준비물은 아직 없어요"}
            </Text>
          ) : null}
          {summary.budget ? (
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
              월 예산 {formatKrw(summary.budget.amountKrw)} 저장됨
            </Text>
          ) : null}
          {!summary.child ? (
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
              아직 저장된 아이 정보가 없어요.
            </Text>
          ) : null}
        </Card>

        <View style={{ gap: theme.spacing.gap }}>
          <PrimaryButton label="이어서 하기" onPress={resume} />
          {canRestart ? <SecondaryButton label="처음부터 시작" onPress={restartFromScratch} /> : null}
        </View>
      </View>
    </AppScreen>
  );
}
