import type { Href } from "expo-router";
import type { OnboardingNextStep, OnboardingProgress } from "../api/client";

/**
 * MOB-101 (round5a-sprint1-plan.md §4): maps the server's onboarding `nextStep` to the route a
 * resuming session should land on. "consents" and "child-profile" both resolve to ONB-001
 * (child-status) -- neither has created a child yet, so restarting the flow from the top is
 * always safe there. "prepared-items" and "budget" jump straight past the screens that already
 * succeeded (skipping ONB-001/ONB-002 entirely) instead of re-running child creation, which is
 * what used to produce a duplicate child on every app restart before this fix.
 */
export function routeForOnboardingNextStep(nextStep: OnboardingNextStep): Href {
  switch (nextStep) {
    case "prepared-items":
      return "/onboarding/prepared-items";
    case "budget":
      return "/onboarding/budget";
    case "home":
      return "/(tabs)";
    case "consents":
    case "child-profile":
    default:
      return "/onboarding/child-status";
  }
}

/**
 * 라운드 51 #2: "이어하기(ONB-006) 화면을 보여줄 만한 진행이 있는가" — app/index.tsx의 판정.
 *
 * 실세션 기준은 종전 그대로 `consentsAccepted`다. 실계정은 로그인 직후 곧장
 * `/onboarding/child-status`로 가므로(app/(auth)/login.tsx), app/index.tsx가 "동의는 했고
 * 아직 끝나지 않은" 진행도를 보는 시점은 언제나 **지난 실행에서 도중에 나갔다**는 뜻이다.
 *
 * 데모(테스트) 세션은 그 전제가 성립하지 않는다: 테스트 로그인은 동의를 대신 기록한 뒤
 * 목적지를 "/"로 두므로 방금 로그인한 사람도 곧바로 이 판정에 닿는다. 동의만으로 이어하기를
 * 띄우면 첫 화면에서 "지난번에는 '아이 프로필 입력' 단계까지 진행했어요"라는 **사실이 아닌
 * 말**을 하게 된다(DNC-018 톤 이전에 사실의 문제다). 그래서 데모에서는 사용자가 실제로 남긴
 * 것 — 아이를 만들었거나(ONB-002) 준비물 단계를 제출했거나(ONB-003) — 이 있을 때만
 * 이어하기로 합류시킨다. 그 경우가 정확히 "입력한 태명이 사라지던" 중간 이탈 상황이고,
 * 아무것도 남기지 않은 데모 사용자는 예전 그대로 ONB-001에서 시작한다.
 *
 * 온보딩을 이미 끝낸 진행도(`completed`)는 이 판정에 오지 않는다 — 호출자가 그보다 먼저
 * markHomeReached()로 처리한다.
 */
export function hasResumeWorthyProgress(progress: OnboardingProgress, isTestSession: boolean): boolean {
  if (!progress.summary.consentsAccepted) return false;
  if (!isTestSession) return true;
  return progress.summary.child !== null || progress.summary.preparedItemsCount !== null;
}
