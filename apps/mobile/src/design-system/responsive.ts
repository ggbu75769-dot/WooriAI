export const LARGE_TEXT_SCALE_THRESHOLD = 1.5;

export function usesLargeTextLayout(fontScale: number) {
  return fontScale >= LARGE_TEXT_SCALE_THRESHOLD;
}

export function compactGridColumnCount(width: number, fontScale: number) {
  if (usesLargeTextLayout(fontScale)) return width >= 900 ? 4 : 2;
  return width >= 600 ? 4 : 3;
}

export function compactGridItemWidth(columns: number) {
  if (columns >= 4) return "23.4%" as const;
  if (columns === 2) return "48.4%" as const;
  return "31.4%" as const;
}

/**
 * 두 시점(A11Y-TAB-001): 종전에는 이 함수를 부르는 **비테스트 호출부가 0건**이었다(형제
 * `compactGridColumnCount`만 두 화면에 배선돼 있었다) → 이제 `app/(tabs)/_layout.tsx`가
 * `tabBarStyle.height`를 이 함수로 만든다. 근거: 탭바 콘텐츠 칸(72−8−10=54dp) 안에서 아이콘 래퍼는
 * 28dp 고정인데 라벨(10)만 배율을 타서, 배율 약 1.33부터 남는 16dp를 넘어선다.
 * 배율 1에서 항등(`adaptiveTabBarHeight(72, 1) === 72`)이라 픽셀락 캡처는 움직이지 않는다.
 */
export function adaptiveTabBarHeight(baseHeight: number, fontScale: number) {
  return baseHeight + Math.max(0, Math.min(fontScale, 2) - 1) * 24;
}
