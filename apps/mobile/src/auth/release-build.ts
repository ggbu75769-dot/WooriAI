/**
 * 라운드 73 트랙 A(GAP-073 #1ⓐ) — **"이 빌드가 무엇인가"를 묻는 술어 한 자리.**
 *
 * 이 저장소에는 빌드 성격을 묻는 자리가 없었고, 대신 **env가 주입됐는가**가 자리마다 그
 * 대용으로 쓰였다. `app/(auth)/login.tsx`의 로그인 실패 문구가 그 사례다 — 갈래의 기준이
 * `isKakaoLoginAvailable()`(= `EXPO_PUBLIC_KAKAO_*` 셋이 주입됐는가)이라서, **카카오 키 없이
 * 만든 스토어 빌드**에도 개발자용 문장("PC와 같은 Wi-Fi에서 API 서버가 켜져 있는지…")이 그대로
 * 실렸다. 그 빌드를 받은 실사용자에게는 PC도 API 서버도 없다.
 *
 * 라운드 65 B(#3)가 고친 "스토어 빌드 첫 화면 문구 뒤집힘"과 **같은 계열의 두 번째 사례**다.
 * 그때는 삼항의 두 갈래가 뒤집혔고 이번엔 삼항의 **기준**이 틀렸다. 뿌리가 같으므로 고치는
 * 방법도 같다: 판정을 한 자리에 세우고, 계약이 그 자리를 값으로 고정한다.
 *
 * ## 무엇이 개발 빌드인가
 *
 * 셋 중 하나라도 참이면 개발(비-실사용자) 빌드다. 셋 다 이 저장소가 **이미 쓰고 있는** 신호이고,
 * 새 env를 만들지 않는다:
 *  - `__DEV__` — Metro 개발 번들. 릴리즈 번들에서는 번들러가 false로 인라인한다.
 *  - `EXPO_PUBLIC_TEST_LOGIN=1` — 데모/테스트 빌드(라운드 65 B · scripts/build-android-apk.ts의
 *    standalone 프로필 · eas.json의 preview).
 *  - `EXPO_PUBLIC_PIXEL_LOCK=1` — 픽셀락 캡처 빌드(scripts/pixel-lock/**).
 *
 * 반대로 **실사용자 빌드**는 그 셋이 모두 거짓인 빌드다. Play에 올라가는 AAB
 * (scripts/build-android-aab.ts)와 production APK가 정확히 그 상태다 — 두 스크립트가
 * `EXPO_PUBLIC_TEST_LOGIN: "0"` · `EXPO_PUBLIC_PIXEL_LOCK: "0"`을 자식 env에 못 박고,
 * 릴리즈 번들이라 `__DEV__`도 false다.
 *
 * ## 왜 카카오 env를 보지 않는가
 *
 * 카카오 키의 유무는 **로그인 경로**의 사실이지 빌드 성격의 사실이 아니다(키를 안 넣고 만든
 * 스토어 빌드도 스토어 빌드다). 그래서 이 술어는 `src/auth/kakao-login.ts`를 읽지 않는다 —
 * 두 질문이 서로를 대용하지 않게 하는 것이 이 모듈의 존재 이유다.
 *
 * `EXPO_PUBLIC_*`는 babel-preset-expo가 **번들 시점에 인라인**하므로 멤버 표현식을 리터럴로
 * 유지한다(kakao-login.ts · legal-links.ts · support-links.ts와 같은 규칙 — 키를 변수로 계산해
 * 넣는 동적 접근은 번들에서 값이 통째로 사라진다).
 */

declare const __DEV__: boolean;

export type BuildCharacter = {
  /** Metro 개발 번들(`__DEV__`). 릴리즈 번들에서는 false. */
  devBundle: boolean;
  /** `EXPO_PUBLIC_TEST_LOGIN=1` — 데모/테스트 빌드. */
  testLogin: boolean;
  /** `EXPO_PUBLIC_PIXEL_LOCK=1` — 픽셀락 캡처 빌드. */
  pixelLock: boolean;
};

/**
 * 순수 판정. 화면·테스트가 같은 표를 보게 하려고 읽기(readBuildCharacter)와 판정을 나눴다 —
 * `__DEV__`는 테스트 실행기에 없는 전역이라, 이 함수만이 네 조합을 값으로 확인할 수 있다.
 */
export function resolveIsDeveloperBuild(character: BuildCharacter): boolean {
  return character.devBundle || character.testLogin || character.pixelLock;
}

/** 지금 빌드의 세 신호. 호출 시점에 읽으므로 테스트가 env를 바꿔 검증할 수 있다. */
export function readBuildCharacter(): BuildCharacter {
  return {
    // `__DEV__`는 RN 런타임 전역이라 다른 실행기(vitest·node 스크립트)에는 없다.
    // 없으면 "개발 번들이 아니다"가 아니라 "그 신호를 못 읽었다"이므로, 나머지 두 신호가
    // 판정을 잇는다 — 없는 전역을 그대로 읽으면 ReferenceError로 로그인 화면이 죽는다.
    devBundle: typeof __DEV__ !== "undefined" && __DEV__ === true,
    testLogin: process.env.EXPO_PUBLIC_TEST_LOGIN === "1",
    pixelLock: process.env.EXPO_PUBLIC_PIXEL_LOCK === "1"
  };
}

/** 개발·테스트·픽셀락 빌드인가. 개발자에게만 하는 말은 이 술어가 참일 때만 선다. */
export function isDeveloperBuild(): boolean {
  return resolveIsDeveloperBuild(readBuildCharacter());
}

/** 실사용자에게 나가는 빌드인가(Play AAB · production APK). `isDeveloperBuild()`의 부정. */
/**
 * ⚠ **테스트 전용 export**(라운드 71 리뷰 S-8 관례 · 라운드 88 트랙 D가 이유를 대장에서 여기로
 * 옮겼다). 화면이 `isRealUserBuild`를 부르지 않는 이유는 **관례**다 — 개발자에게만 하는 말은 긍정형이 참일
 * 때 세운다(`isDeveloperBuild()`). 부정형으로 물으면 "실사용자에게만 세우는 것"이 되어 같은 축의
 * 관례가 두 방향으로 갈린다. **지우지 않는다** — 지우는 판단은 그 관례를 어느 방향으로 고정할지
 * 정한 다음이고, 오늘 이 한 줄이 하는 일은 그 갈림을 값으로 지켜 두는 것이다.
 */
export function isRealUserBuild(): boolean {
  return !isDeveloperBuild();
}
