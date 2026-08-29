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

/* --------------------------------------------------------- 로그인 실패 문구 두 갈래
 *
 * 라운드 73 트랙 A(GAP-073 #1ⓐ) — **갈래의 기준이 틀렸다.**
 *
 * 종전 이 두 문장은 화면 안 삼항에 있었고 기준이 `isKakaoLoginAvailable()`이었다 — 즉
 * **env가 주입됐는가**. 그런데 "PC와 같은 Wi-Fi" 문장은 개발 스텁 경로(로컬 API 서버)를 위한
 * 것이고, env 부재는 빌드 성격이 아니다. 그래서 **카카오 키 없이 만든 스토어 빌드**의
 * 실사용자가 "카카오로 시작하기"를 누르면(서버의 oauthLogin은 프로덕션에서 501 fail-closed다 —
 * apps/api auth.service.ts) 그 개발자용 문장을 받았다. 그 사람에게는 PC도 API 서버도 없다.
 *
 * 기준을 **빌드 성격**으로 바꾼다(src/auth/release-build.ts). 두 문장은 **바이트 단위로 종전
 * 그대로**이고 새 문구는 0건이다 — 바뀐 것은 어느 빌드가 어느 문장을 받는가뿐이다.
 *
 * 갈래가 둘 다 필요한 이유(부정으로 적는다):
 *  - 개발 빌드 + 카카오 미설정 = 실제로 로컬 API 서버를 보는 유일한 상태 → Wi-Fi 문장.
 *  - 개발 빌드 + 카카오 설정 = 실 카카오·실 서버를 본다 → 종전대로 첫 문장(무변경).
 *  - 실사용자 빌드 = **어느 경우에도** Wi-Fi 문장에 닿지 않는다(도달 불가 · 부정 단언).
 */

/** 실 서버를 보는 빌드의 로그인 실패 문구(카카오 경로 · 실사용자 빌드 공통). */
export const LOGIN_FAILED_MESSAGE = "로그인 중 문제가 발생했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.";

/**
 * **개발 빌드에서 개발 스텁 경로가 실패했을 때만** 서는 문장. 여기서 말하는 "API 서버"는
 * 개발자 PC에서 도는 로컬 프로세스라, 실사용자 빌드에 실리면 그 자체로 허위 안내가 된다.
 */
export const DEV_STUB_LOGIN_FAILED_MESSAGE =
  "서버에 연결할 수 없어요. PC와 같은 Wi-Fi에서 API 서버가 켜져 있는지 확인해 주세요.";

/**
 * 타입 없는 로그인 실패(네트워크·서버)에 보여 줄 문장.
 *
 * `developerBuild`는 `isDeveloperBuild()`(빌드 성격), `kakaoConfigured`는
 * `isKakaoLoginAvailable()`(경로 선택)에서 온다 — **두 질문을 분리해 두는 것**이 이 함수의
 * 계약이다. 하나가 다른 하나의 대용으로 쓰이면 라운드 73이 고친 그 결함이 다시 생긴다.
 */
export function loginFailureMessage({
  developerBuild,
  kakaoConfigured
}: {
  developerBuild: boolean;
  kakaoConfigured: boolean;
}): string {
  return developerBuild && !kakaoConfigured ? DEV_STUB_LOGIN_FAILED_MESSAGE : LOGIN_FAILED_MESSAGE;
}
