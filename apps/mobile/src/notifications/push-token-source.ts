/**
 * PUSH-116: device push-token source scaffold -- the mobile half of the push pipeline whose
 * server half (POST /me/devices 등록 API + FCM 발송, NOTI-100/PUSH-113) already ships.
 *
 * `expo-notifications` is intentionally NOT a dependency yet (새 의존성 추가는 사용자 몫), so
 * this module is a flag-gated scaffold in the AUTH-102 (src/auth/kakao-login.ts) tradition:
 * fully wired, but inert -- `getPushToken()` resolves `null` -- until the user activates it.
 *
 * ## 활성 절차 (코드 변경 없이 아래만 하면 켜집니다)
 *
 * 1. 의존성 추가 1줄 (apps/mobile에서):
 *      npx expo install expo-notifications
 *    (또는 `pnpm --filter mobile add expo-notifications` 후 버전을 expo 52 호환으로 맞춤)
 * 2. Android FCM 자격: Firebase 콘솔에서 앱 등록 후 google-services.json을 apps/mobile/에
 *    두고 app.json의 android에 `"googleServicesFile": "./google-services.json"`을 추가,
 *    `expo prebuild`로 재생성 (android/는 gitignore -- 손패치 금지, CLAUDE.md 참고).
 * 3. 서버 발송 켜기: .env의 `PUSH_ENABLED=1` + `FCM_SERVICE_ACCOUNT_PATH`(서비스 계정 JSON
 *    파일 경로 -- 내용을 코드/로그에 넣지 말 것, DNC-019).
 * 4. 모바일 빌드에 `EXPO_PUBLIC_PUSH_ENABLED=1` 주입 (.env.example 참고).
 *
 * ## 토큰 종류: 네이티브 FCM 디바이스 토큰
 *
 * 서버 발송 경로(apps/api/src/push/fcm-sender.service.ts)는 Expo push service가 아니라 FCM
 * HTTP v1(`fcm.googleapis.com/v1/.../messages:send`)로 직접 보내므로, 등록해야 하는 값은
 * `getExpoPushTokenAsync()`의 ExponentPushToken[...]이 아니라
 * `getDevicePushTokenAsync()`가 주는 네이티브 디바이스 토큰이다.
 *
 * ## 미설치 상태에서의 동작 (동적 require try/catch)
 *
 * `require("expo-notifications")`는 try/catch 안의 optional dependency다: Expo의 metro
 * 설정은 try/catch 내 require의 해석 실패를 빌드 에러가 아닌 런타임 throw로 미루므로
 * (@expo/metro-config의 allowOptionalDependencies), 패키지가 없는 오늘의 빌드도 그대로
 * 통과하고 -- 위 1번으로 설치되는 순간 별도 코드 변경 없이 번들에 포함된다. vitest/node
 * 환경에서도 같은 이유(모듈 부재 → throw → catch)로 안전하게 null이 된다.
 */

/**
 * Build-time flag gate (babel-preset-expo가 EXPO_PUBLIC_*를 번들 시점에 인라인하므로 멤버
 * 표현식을 리터럴로 유지 -- kakao-login.ts의 getKakaoEnvConfig와 같은 규칙). "1" 외의 값은
 * 전부 off: 미설정 데모/개발 빌드는 푸시 경로 전체가 완전히 비활성이다.
 */
export function isPushEnabled(): boolean {
  return process.env.EXPO_PUBLIC_PUSH_ENABLED === "1";
}

/** 서버 RegisterDeviceDto의 pushToken 상한(2000자) 미러 -- 초과분은 등록 시도 전에 거른다. */
export const MAX_PUSH_TOKEN_LENGTH = 2000;

/** The minimal expo-notifications surface this scaffold uses (typed by hand -- the package's
 * own types only exist once it is installed). */
export type ExpoNotificationsModule = {
  getPermissionsAsync(): Promise<{ granted: boolean }>;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  getDevicePushTokenAsync(): Promise<{ type: string; data: unknown }>;
};

/** Dynamic require in try/catch -- see the module comment for why this is build-safe while
 * expo-notifications is not installed. */
export function tryLoadExpoNotifications(): ExpoNotificationsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-notifications") as ExpoNotificationsModule;
  } catch {
    return null;
  }
}

/**
 * True only when the flag is on AND expo-notifications is actually installed -- what the
 * SET-006 settings screen uses to decide between a live 푸시 토글 and the honest
 * "앱 업데이트 후 사용 가능" disabled state (기능이 없는데 있는 척 금지).
 */
export function isPushSupported(loadModule: () => ExpoNotificationsModule | null = tryLoadExpoNotifications): boolean {
  return isPushEnabled() && loadModule() !== null;
}

export type GetPushTokenOptions = {
  /**
   * When true, a missing OS notification permission triggers the system prompt
   * (requestPermissionsAsync) -- only the settings screen's explicit 토글 does this. The boot
   * hook always uses the default (false): silently read the current permission, never
   * surprise the user with a prompt at app start.
   */
  requestPermission?: boolean;
  /** Test seam -- production callers never pass this. */
  loadModule?: () => ExpoNotificationsModule | null;
};

/**
 * Resolves the native FCM/APNs device push token, or `null` whenever push cannot work right
 * now: flag off, expo-notifications not installed, OS permission missing (and not asked for),
 * or the native module throwing. Never rejects -- callers treat null as "푸시 없음" and move on.
 */
export async function getPushToken(options: GetPushTokenOptions = {}): Promise<string | null> {
  if (!isPushEnabled()) return null;
  const notifications = (options.loadModule ?? tryLoadExpoNotifications)();
  if (!notifications) return null;
  try {
    let permission = await notifications.getPermissionsAsync();
    if (!permission.granted && options.requestPermission) {
      permission = await notifications.requestPermissionsAsync();
    }
    if (!permission.granted) return null;
    const token = await notifications.getDevicePushTokenAsync();
    const data = token?.data;
    if (typeof data !== "string" || data.length === 0 || data.length > MAX_PUSH_TOKEN_LENGTH) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
