/**
 * 라운드 65 B(#3) — 로그인 첫 화면(AUTH-001)의 **env로 갈리는 문구 한 벌**.
 *
 * 왜 모듈로 뺐나: 화면 안의 삼항에서 두 갈래의 문구가 **서로 뒤바뀌어** 있었다. 테스트
 * 빌드(`EXPO_PUBLIC_TEST_LOGIN=1`)에는 "테스트 계정도 실제 가입과 똑같이 시작해요."가,
 * **그 밖의 모든 빌드**(Play 업로드 AAB·production APK는 `EXPO_PUBLIC_TEST_LOGIN="0"`이다 —
 * scripts/build-android-aab.ts · scripts/build-android-apk.ts)에는 "준비된 테스트 계정으로
 * 로그인하고 우리아이의 주요 화면을 편하게 둘러보세요."가 붙어 있었다. 즉 **실사용자가 받는
 * 빌드에만** 있지도 않은 테스트 계정을 안내했고, 개발 빌드에서는 재현되지 않아 어떤 자동 경로도
 * 이것을 보지 못했다(AUTH-001은 픽셀락 대상이 아니다 — scripts/pixel-lock/pixel-lock-screens.json).
 *
 * 갈래를 **한 함수 안에 나란히** 두면 두 문구가 같은 자리에서 읽히고, 계약 테스트가 값으로
 * 고정할 수 있다("스토어 갈래는 테스트 계정을 말하지 않는다"). 문구는 해요체(DNC-018).
 */

/** 테스트 빌드(EXPO_PUBLIC_TEST_LOGIN=1): 데이터 0에서 실가입과 같은 여정을 탄다는 사실. */
export const TEST_LOGIN_SUBTITLE =
  "테스트 계정도 실제 가입과 똑같이 시작해요.\n아이 정보를 입력하면 바로 기록할 수 있어요.";

/** 스토어/실사용 빌드: 카카오로 진짜 가입하고 곧바로 온보딩(아이 정보)으로 간다는 사실. */
export const STORE_LOGIN_SUBTITLE =
  "카카오로 로그인하면 아이 정보부터 차근차근 시작해요.\n입력을 마치면 바로 기록할 수 있어요.";

/**
 * 로그인 히어로 부제. 두 갈래가 **서로 다른 사실**을 말하지 않게 하는 유일한 자리다 —
 * 테스트 빌드에서만 "테스트 계정"을 말하고, 그 밖의 빌드는 실제 동작(카카오 로그인 → 온보딩)만
 * 말한다.
 */
export function loginSubtitle(isTestLoginEnabled: boolean): string {
  return isTestLoginEnabled ? TEST_LOGIN_SUBTITLE : STORE_LOGIN_SUBTITLE;
}
