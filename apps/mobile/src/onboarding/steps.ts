export const onboardingSteps = [
  { screenId: "ONB-001", route: "/onboarding/child-status", title: "아이 상태 선택" },
  { screenId: "ONB-002", route: "/onboarding/child-profile", title: "아이 프로필 입력" },
  { screenId: "ONB-003", route: "/onboarding/prepared-items", title: "이미 준비한 물건 체크" },
  { screenId: "ONB-004", route: "/onboarding/budget", title: "월 예산 설정" }
] as const;

export type OnboardingScreenId = (typeof onboardingSteps)[number]["screenId"];
