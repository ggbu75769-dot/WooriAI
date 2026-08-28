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

/* --------------------------------------------------------------- CTA · 꼬리말
 *
 * 라운드 65 후속(#6) — **부제만 승격하고 나머지 두 갈래는 화면 안 삼항에 남아 있었다.**
 *
 * 이 화면에서 `isTestLoginEnabled`로 갈리는 사용자 문구는 셋이다: 부제, CTA 라벨, 그 아래
 * 꼬리말. #3이 고친 결함(두 갈래가 서로 뒤바뀜)은 문구의 종류와 무관하게 **삼항 하나에서**
 * 났고, 그 삼항은 CTA와 꼬리말에도 똑같이 하나씩 남아 있었다 — 같은 사고가 두 번 더 일어날
 * 자리를 그대로 둔 셈이다. 세 갈래를 같은 모듈에 나란히 세우면 계약 테스트가 값으로 고정할 수
 * 있다("스토어 갈래는 테스트 계정을 말하지 않는다"가 세 문구 모두에 걸린다).
 */

/** 테스트 빌드의 CTA. 이 버튼이 실제로 하는 일(로컬 데모 세션 시작)을 말한다. */
export const TEST_LOGIN_CTA_LABEL = "테스트 계정으로 시작하기";

/** 스토어/실사용 빌드의 CTA. 카카오 OIDC 로그인으로 들어간다. */
export const STORE_LOGIN_CTA_LABEL = "카카오로 시작하기";

/**
 * CTA 라벨(진행 중 상태 제외 — "로그인 중..."은 갈래가 아니라 상태라 화면이 진다).
 * 갈래가 뒤바뀌면 테스트 APK가 "카카오로 시작하기"라고 적고 카카오를 부르지 않는다.
 */
export function loginCtaLabel(isTestLoginEnabled: boolean): string {
  return isTestLoginEnabled ? TEST_LOGIN_CTA_LABEL : STORE_LOGIN_CTA_LABEL;
}

/**
 * 테스트 빌드의 꼬리말. **데모/실계정 구분**을 지는 문장이라(DNC) 갈래가 뒤바뀌면 곧바로
 * 허위 표시가 된다 — 실사용자 빌드에 붙으면 "진짜 카카오 로그인이 아니다"라는 거짓말이 되고,
 * 테스트 빌드에서 사라지면 데모임을 알리는 표시가 통째로 없어진다.
 */
export const TEST_LOGIN_FOOTNOTE = "기록은 이 기기에만 저장되며 실제 카카오 로그인이 아니에요.";

/** 스토어/실사용 빌드의 꼬리말. 실제로 저장되는 것(계정에 남는 필수 동의)만 말한다. */
export const STORE_LOGIN_FOOTNOTE = "로그인하면 필수 약관 동의가 계정에 저장돼요.";

/** CTA 아래 한 줄. 갈래는 CTA·부제와 **같은 방향**이어야 한다(세 문구가 한 빌드를 말한다). */
export function loginFootnote(isTestLoginEnabled: boolean): string {
  return isTestLoginEnabled ? TEST_LOGIN_FOOTNOTE : STORE_LOGIN_FOOTNOTE;
}
