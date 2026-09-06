import { useHapticsStore } from "../stores/haptics.store";

/**
 * 라운드 101 트랙 B: 햅틱(터치 반응) 스캐폴드 — 핵심 루프의 세 순간(저장 확정 · 상태 체크 ·
 * 경고)에 촉각 확인을 더하는 모바일 조각.
 *
 * `expo-haptics`는 의도적으로 아직 의존성이 **아니다**(새 의존성 추가는 사용자 몫 —
 * push-token-source.ts의 expo-notifications와 같은 판단). 그래서 이 모듈은 PUSH-116 전통의
 * optional-require 스캐폴드다: 완전히 배선돼 있지만, 패키지가 없는 오늘의 빌드에서는 아래
 * 표면이 (경고의 Vibration 폴백 하나를 빼면) 전부 안전한 no-op이다.
 *
 * ## 활성 절차 (코드 변경 없이 아래 한 줄이면 켜집니다)
 *
 * 1. 의존성 추가 1줄 (apps/mobile에서):
 *      npx expo install expo-haptics
 *    (또는 `pnpm --filter mobile add expo-haptics` 후 버전을 expo SDK 호환으로 맞춤)
 *
 * 끝 — env 플래그도 prebuild도 필요 없다(expo-haptics는 config plugin 없이 동작하는
 * 순수 네이티브 모듈이라 푸시의 ②~④ 같은 자산 절차가 없다). 설치되는 순간 세 함수가
 * iOS/Android 양쪽에서 실제 햅틱을 낸다.
 *
 * ## 미설치 상태에서의 동작 (동적 require try/catch)
 *
 * `require("expo-haptics")`는 try/catch 안의 optional dependency다: Expo의 metro 설정은
 * try/catch 내 require의 해석 실패를 빌드 에러가 아닌 런타임 throw로 미루므로
 * (@expo/metro-config의 allowOptionalDependencies), 패키지가 없는 오늘의 빌드도 그대로
 * 통과하고 — 위 1번으로 설치되는 순간 별도 코드 변경 없이 번들에 포함된다. vitest/node
 * 환경에서도 같은 이유(모듈 부재 → throw → catch)로 안전하게 null이 된다.
 *
 * ## 세기 선택 — 성공/선택은 폴백 없음, 경고만 Vibration 폴백
 *
 * expo-haptics가 없어도 RN 코어 `Vibration`은 있다. 그런데 Vibration은 햅틱 엔진이 아니라
 * **모터 전체를 울리는** 구식 진동이라(iOS에서는 1초 고정 — 길이 인자 무시), 저장·체크처럼
 * 하루에 수십 번 도는 확인 신호로 쓰면 확인이 아니라 소음이 된다. 그래서:
 *  · 성공(hapticSuccess)·선택(hapticSelection)은 폴백 없이 no-op — 없는 것이 과한 것보다 낫다.
 *  · 경고(hapticWarning)만 Vibration 폴백을 탄다. 경고는 드물고(PIN 오류), 주의를 끄는 것이
 *    목적이라 굵은 진동이 오히려 뜻에 맞다. 단 **Android 한정, 짧은 1회**다 — iOS의 1초 고정
 *    진동은 "짧은 경고"가 될 수 없어서 iOS 폴백은 만들지 않는다(설치 전까지 iOS 경고는 no-op).
 *
 * ## 사용자 끔 = 전부 no-op
 *
 * 세 함수 모두 발화 직전에 설정 스토어(src/stores/haptics.store.ts, 기본 켬)를 읽는다.
 * 꺼져 있으면 모듈 로드조차 하지 않는다 — 폴백 포함 어떤 진동도 나지 않는다.
 *
 * ⚠️ 채택 지점은 전부 **핸들러/콜백 안**이다(저장 onSuccess · 상태 체크 확정 · PIN 오류).
 * 렌더 경로에서 부르지 말 것 — EXP-001/ITEM-001 비세션 렌더 무접촉 계약과 무관해야 하고,
 * 렌더마다 진동이 나는 화면은 그 자체로 결함이다.
 */

/** The minimal expo-haptics surface this scaffold uses (typed by hand -- the package's own
 * types only exist once it is installed). */
export type ExpoHapticsModule = {
  selectionAsync(): Promise<unknown>;
  notificationAsync(type: unknown): Promise<unknown>;
  NotificationFeedbackType: { Success: unknown; Warning: unknown; Error: unknown };
};

/** Dynamic require in try/catch -- see the module comment for why this is build-safe while
 * expo-haptics is not installed. */
export function tryLoadExpoHaptics(): ExpoHapticsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-haptics") as ExpoHapticsModule;
  } catch {
    return null;
  }
}

/** 경고 폴백이 쓰는 최소 표면 — react-native도 여기서는 동적 require다(이 모듈은 vitest에서
 * 직접 import되는데, react-native 본체는 node에서 파싱되지 않는다 → throw → catch → null). */
export type VibrationFallbackModule = {
  platformOs: string;
  vibrate: (ms: number) => void;
};

export function tryLoadVibrationFallback(): VibrationFallbackModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require("react-native") as {
      Platform: { OS: string };
      Vibration: { vibrate: (ms: number) => void };
    };
    return { platformOs: rn.Platform.OS, vibrate: (ms) => rn.Vibration.vibrate(ms) };
  } catch {
    return null;
  }
}

// Android Vibration 폴백의 길이. "짧은 1회"가 계약이다 — 알림 진동(수백 ms)과 겹치지 않는
// 톡 수준. 모듈 밖에서 쓸 일이 없어 export하지 않는다.
const WARNING_FALLBACK_VIBRATION_MS = 80;

export type HapticOptions = {
  /** Test seam -- production callers never pass this. */
  loadModule?: () => ExpoHapticsModule | null;
  /** Test seam -- production callers never pass this. */
  isEnabled?: () => boolean;
  /** Test seam (경고 폴백 전용) -- production callers never pass this. */
  loadFallback?: () => VibrationFallbackModule | null;
};

function hapticsUserEnabled(): boolean {
  return useHapticsStore.getState().hapticsEnabled;
}

/** 발화 한 자리 — 프로미스 거절·동기 throw 모두 삼킨다(햅틱 실패가 저장 흐름을 깨면 주객전도다). */
function fireAndForget(run: () => Promise<unknown>): void {
  try {
    void Promise.resolve(run()).catch(() => {
      // 무시한다 — 촉각 확인은 보조 채널이고, 실패는 조용한 no-op이 맞다.
    });
  } catch {
    // 동기 throw도 같은 이유로 삼킨다.
  }
}

/**
 * 저장 확정의 촉각 확인 (지출 저장 onSuccess 등). 미설치·꺼짐이면 no-op — 폴백 없음(위 머리말).
 */
export function hapticSuccess(options: HapticOptions = {}): void {
  if (!(options.isEnabled ?? hapticsUserEnabled)()) return;
  const haptics = (options.loadModule ?? tryLoadExpoHaptics)();
  if (!haptics) return;
  fireAndForget(() => haptics.notificationAsync(haptics.NotificationFeedbackType.Success));
}

/**
 * 상태 체크·세그먼트 전환의 촉각 확인. 미설치·꺼짐이면 no-op — 폴백 없음(위 머리말).
 */
export function hapticSelection(options: HapticOptions = {}): void {
  if (!(options.isEnabled ?? hapticsUserEnabled)()) return;
  const haptics = (options.loadModule ?? tryLoadExpoHaptics)();
  if (!haptics) return;
  fireAndForget(() => haptics.selectionAsync());
}

/**
 * 경고의 촉각 신호 (PIN 오류 등). 미설치면 **Android 한정 짧은 1회** Vibration 폴백,
 * 꺼짐이면 폴백 포함 전부 no-op.
 */
export function hapticWarning(options: HapticOptions = {}): void {
  if (!(options.isEnabled ?? hapticsUserEnabled)()) return;
  const haptics = (options.loadModule ?? tryLoadExpoHaptics)();
  if (haptics) {
    fireAndForget(() => haptics.notificationAsync(haptics.NotificationFeedbackType.Warning));
    return;
  }
  const fallback = (options.loadFallback ?? tryLoadVibrationFallback)();
  if (!fallback || fallback.platformOs !== "android") return;
  try {
    fallback.vibrate(WARNING_FALLBACK_VIBRATION_MS);
  } catch {
    // Vibration 권한 부재 등 — 경고 문구는 화면이 이미 말했다(진동은 보조 채널).
  }
}
