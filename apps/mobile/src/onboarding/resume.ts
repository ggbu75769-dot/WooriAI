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
 * ## 라운드 99 트랙 F1(H) — **실세션도 데모와 같은 기준이다** (⚠️ 두 시점)
 *
 * 종전에는 갈래가 둘이었다: 실세션은 `consentsAccepted`만으로 이어하기 대상이었고, 데모만
 * "사용자가 실제로 남긴 것"을 요구했다. 그 비대칭의 전제는 *"실계정은 로그인 직후 곧장
 * `/onboarding/child-status`로 가므로, app/index.tsx가 '동의는 했고 아직 끝나지 않은' 진행도를
 * 보는 시점은 언제나 지난 실행에서 도중에 나갔다는 뜻이다"* 였다.
 *
 * **그 전제는 이번 라운드에 죽었다.** 로그인 성공의 목적지가 실세션도 "/"로 통일되면서
 * (app/(auth)/login.tsx — 기존 사용자의 재로그인이 서버 진행도를 묻지 않고 온보딩으로 가
 * 중복 아이를 만들던 길을 막는다), 방금 로그인한 실계정도 — 로그인 화면이 동의를 막 올린
 * 직후에 — 곧바로 이 판정에 닿는다. 데모가 라운드 51에 만난 그 상황 그대로다: 동의만으로
 * 이어하기를 띄우면 방금 가입한 사람에게 "하던 곳부터 계속할까요?"라고 묻게 된다(사실이 아닌
 * 말 — DNC-018 톤 이전에 사실의 문제다).
 *
 * 그래서 기준은 한 벌이다: 사용자가 실제로 남긴 것 — 아이를 만들었거나(ONB-002) 준비물
 * 단계를 제출했거나(ONB-003) — 이 있을 때만 이어하기로 합류시킨다. 그 경우가 정확히 "입력한
 * 태명이 사라지던" 중간 이탈 상황이고, 아무것도 남기지 않은 계정은 ONB-001에서 시작한다
 * (동의만 하고 지난 실행에서 나간 실계정도 ONB-001로 가는데, 그 화면이 곧 이어하기가
 * 가리키던 목적지다 — routeForOnboardingNextStep의 "consents"/"child-profile" 두 줄).
 *
 * 온보딩을 이미 끝낸 진행도(`completed`)는 이 판정에 오지 않는다 — 호출자가 그보다 먼저
 * markHomeReached()로 처리한다.
 */
export function hasResumeWorthyProgress(progress: OnboardingProgress): boolean {
  if (!progress.summary.consentsAccepted) return false;
  return progress.summary.child !== null || progress.summary.preparedItemsCount !== null;
}
