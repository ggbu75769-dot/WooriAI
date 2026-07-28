export const onboardingSteps = [
  { screenId: "ONB-001", route: "/onboarding/child-status", title: "아이 정보" },
  { screenId: "ONB-002", route: "/onboarding/prepared-items", title: "준비 현황" },
  { screenId: "ONB-003", route: "/onboarding/budget", title: "월 예산" }
] as const;

export type OnboardingScreenId = (typeof onboardingSteps)[number]["screenId"];
