export const semanticColors = {
  background: "#FFFDFC",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#F8F6F4",
  textPrimary: "#211E1C",
  textSecondary: "#5F5854",
  textDisabled: "#A99E97",
  textInverse: "#FFFFFF",
  borderSubtle: "#E5DFDB",
  borderStrong: "#D3CAC4",
  border: "#E5DFDB",
  brandPrimary: "#C94627",
  brandSecondary: "#267A68",
  accent: "#B45309",
  actionPrimary: "#C94627",
  actionSecondary: "#FFF4EF",
  actionDestructive: "#B42318",
  actionDisabled: "#E5DFDB",
  successSurface: "#ECF8F1",
  warningSurface: "#FFF7E8",
  dangerSurface: "#FFF0EE",
  infoSurface: "#EFF5FF",
  reviewSurface: "#F5F0FF",
  success: "#16794B",
  warning: "#B45309",
  danger: "#B42318",
  info: "#1D4ED8",
  review: "#7C3AED",
  focus: "#2F6FED",
  overlay: "rgba(33, 30, 28, 0.48)",
  // 라운드 102 TK3 — BudgetHeroCard(ModV1Primitives) 진행 바 트랙: 코랄/위험색 히어로 위
  // 흰 반투명 32%. 값은 그 컴포넌트에 박혀 있던 종전 리터럴 그대로다(값 교체 0건 —
  // 대조: src/color-literal-tokenization.test.ts). c20deeb 이식 값들은 위에서 무수정이다.
  progressTrackInverse: "rgba(255,255,255,0.32)"
} as const;

export const chartColors = ["#C94627", "#267A68", "#2F6FED", "#B45309", "#7C3AED", "#7A716B"] as const;
