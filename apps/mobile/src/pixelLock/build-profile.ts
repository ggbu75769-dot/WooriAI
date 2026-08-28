/**
 * DSN-053 P1: c20deeb의 `src/pixelLock/build-profile.ts`에서 이식.
 *
 * 픽셀 락 캡처 빌드인지 한 곳에서 판정한다. 현재 트리의 화면들은 각자
 * `process.env.EXPO_PUBLIC_PIXEL_LOCK === "1"`을 직접 읽고 있고, 그 판정과 **같은 값**이다 --
 * 이 모듈은 이식한 design-system 컴포넌트(ApplicationPrimitives의 `AppScreen`)가 원본대로
 * 참조하기 위한 것이지, 기존 화면의 판정을 옮기려는 것이 아니다(화면 재작성은 P2).
 */
export function isPixelLockBuild() {
  return process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";
}
