export const semanticColors = {
  background: "#FFFDFC",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#F8F6F4",
  textPrimary: "#211E1C",
  textSecondary: "#5F5854",
  textDisabled: "#A99E97",
  /**
   * 입력칸 플레이스홀더 전용 잉크 — theme.ts의 `text.placeholder`와 **같은 값**이다(그 토큰의
   * 주석이 값의 근거를 든다). 여기에 사본이 서는 이유는 이 레이어가 theme을 부르지 않기
   * 때문이다(`progressTrackInverse`가 선 것과 같은 사정).
   *
   * 종전(그때는 참): design-system 쪽 플레이스홀더 두 자리는 `textDisabled`(#A99E97)를 썼다.
   * 그때는 "흐린 글자"라는 한 낱말로 비활성 텍스트와 플레이스홀더가 묶여 있었다.
   * → 이제: 둘을 쪼갠다. 오늘 실측으로 #A99E97 on `surface`(#FFFFFF) = **2.62:1**이고,
   * 비활성 텍스트는 WCAG 1.4.3의 예외라 그 값이 문제가 아니지만 **플레이스홀더는 예외가
   * 아니다**. `textDisabled`는 값·자리 그대로 두고(토글 off 아이콘 · 비활성 라벨 · 접기
   * 셰브런) 플레이스홀더만 이 토큰으로 옮겼다.
   */
  textPlaceholder: "#756C66",
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
