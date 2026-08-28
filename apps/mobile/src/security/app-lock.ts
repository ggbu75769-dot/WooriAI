/**
 * 라운드 55 트랙 B — 앱 잠금(PIN) 순수 판정 (docs/5차/round55-plan.md §2).
 *
 * 이 파일에는 **저장소도 화면도 react-native도 들어오지 않는다**. 해시·검증·실패 지연·유예
 * 판정·게이트 상태표·문구가 전부 값과 순수 함수로 고정돼 있어 vitest에서 그대로 돌아간다
 * (저장소의 순수 모듈 규율 — src/onboarding/cold-start-hold.ts, src/notifications/generators.ts).
 *
 * 새 패키지 0 (§2.9-1): 해시는 저장소에 이미 있는 순수 JS SHA-256(src/auth/sha256.ts), 난수는
 * PKCE의 getRandomBytes(src/auth/pkce.ts) 관례를 그대로 재사용한다. `expo-crypto`도
 * `expo-local-authentication`도 이 저장소에 없고, 이 기능 때문에 추가하지 않는다.
 *
 * ⚠️ 이 잠금이 무엇인지 (§6 위험 1·§2.6):
 * 4자리 PIN + 솔티드 SHA-256은 KDF가 아니다. 후보가 1만 개뿐이라 기기가 루팅돼 SecureStore
 * 블롭이 유출되면 즉시 역산된다. 게다가 "PIN을 잊으셨나요?" 탈출구(로그아웃)가 있으므로 PIN을
 * 모르는 사람도 앱을 초기 상태로 되돌릴 수 있다 — 다만 그 사람은 계정에 로그인할 수 없어
 * 데이터는 보지 못한다. 즉 이 잠금이 막는 것은 **"잠깐 빌려준 폰에서 곁눈질"** 하나뿐이고,
 * 아래 문구들이 그보다 크게 말하지 않는 것이 계약이다(APP_LOCK_SCOPE_NOTICE).
 *
 * ⚠️ 밸브 방향 (§2.5):
 * 저장소의 다른 3초 밸브(app/index.tsx 두 곳, useHomeNotificationEvaluation)는 "모르면 진행"
 * 이다. 잠금에서 그대로 열면 그게 곧 잠금 우회다. 그래서 여기서는 `unknown` → `recovery`로
 * **닫는다**. 브릭이 되지 않는 이유는 recovery 화면에 로그아웃 탈출구가 있기 때문이다.
 */
import { getRandomBytes, toBase64Url } from "../auth/pkce";
import { sha256 } from "../auth/sha256";
import { COLD_START_HOLD_COPY, COLD_START_HOLD_TITLE } from "../onboarding/cold-start-hold";

/** PIN 자릿수. 숫자 4자리 고정(패턴·비밀번호를 만들지 않는다). */
export const APP_LOCK_PIN_LENGTH = 4;

/** 연속 실패 몇 번마다 대기를 세우는가. */
export const APP_LOCK_MAX_ATTEMPTS = 5;

/**
 * 5회 실패마다 적용되는 대기 시간(30초 → 60초 → 300초 상한).
 * 카운터·해제 시각은 SecureStore에 저장하므로 앱을 죽였다 켜도 유지된다 — 메모리 카운터는
 * 강제 종료 한 번으로 우회된다(§2.6, 수용 기준 5).
 */
export const APP_LOCK_LOCKOUT_STEPS_MS = [30_000, 60_000, 300_000] as const;

/** 표시·계산에 쓰는 대기 상한. 시계를 과거로 돌려도 이 값 이상으로 커 보이지 않게 한다. */
export const APP_LOCK_LOCKOUT_MAX_MS = APP_LOCK_LOCKOUT_STEPS_MS[APP_LOCK_LOCKOUT_STEPS_MS.length - 1];

/**
 * 백그라운드 유예(§2.6). 0으로 두면 안 되는 이유가 실제로 셋 있다 — 엑셀 가져오기의 파일
 * 선택(expo-document-picker), CSV 내보내기의 공유 시트, 카카오 로그인의 외부 브라우저. 셋 다
 * 앱을 백그라운드로 보낸다. 60초를 넘기는 파일 선택은 여전히 재잠금된다(§6 위험 3).
 */
export const APP_LOCK_GRACE_MS = 60_000;

/**
 * 잠금 기록을 읽는 동안의 안전 밸브. app/index.tsx의 두 밸브 · NOTIFICATION_HYDRATION_VALVE_MS와
 * **같은 3000ms**다(같은 실패 모드를 다루는 자리가 서로 다른 상한을 갖지 않게). 방향만 반대다 —
 * 위 모듈 주석 참고.
 */
export const APP_LOCK_VALVE_MS = 3000;

/** 솔트 길이(바이트). base64url 22자. */
export const APP_LOCK_SALT_BYTES = 16;

export const APP_LOCK_RECORD_VERSION = 1;

/**
 * SecureStore 한 키에 담기는 잠금 상태 전량(§2.3).
 * 평문 PIN은 어디에도 저장하지 않는다(DNC-019). 기본 PIN도 없다.
 */
export type AppLockRecord = {
  version: typeof APP_LOCK_RECORD_VERSION;
  enabled: boolean;
  /** base64url, getRandomBytes(16). 설정할 때마다 새로 뽑는다. */
  salt: string;
  /** base64url(sha256(`${salt}:${pin}`)). */
  hash: string;
  /** 마지막 성공 이후 연속 실패 횟수. 성공하면 0으로 돌아간다. */
  failedCount: number;
  /** 이 시각(epoch ms) 전에는 입력을 받지 않는다. 대기가 없으면 null. */
  lockedUntilMs: number | null;
};

/** 게이트가 지금 무엇을 그려야 하는가. 화면은 이 다섯 값만 본다. */
export type AppLockGateStatus = "inactive" | "loading" | "locked" | "recovery" | "unlocked";

/** SecureStore에서 잠금 기록을 읽어 본 결과. `unknown`은 "아직 모른다"(부팅 직후·읽는 중). */
export type AppLockRecordStatus = "unknown" | "loaded" | "unreadable";

export type AppLockGateInput = {
  /** `EXPO_PUBLIC_PIXEL_LOCK === "1"` — 캡처 경로는 무조건 통과시킨다(SPL-001·HOME-001…). */
  pixelLockMode: boolean;
  /** 실토큰 또는 데모 세션. 로그인/스플래시 화면은 잠그지 않는다. */
  hasSession: boolean;
  recordStatus: AppLockRecordStatus;
  /** 읽어 온 기록의 enabled. 기록이 없으면 false. */
  enabled: boolean;
  /** 이번 포그라운드에서 이미 PIN을 통과했는가. */
  unlockedThisForeground: boolean;
};

/**
 * 판정 순서는 coldStartHoldReason이 세운 규율 그대로다 — 화면이 리터럴을 세 자리에 흩뿌리면
 * 판정표가 두 벌이 된다(라운드 52 QA P3-4).
 *
 * 1. 픽셀락 → inactive (캡처 경로 불변. 픽셀락은 세션도 지우므로 2번의 이중 안전장치다)
 * 2. 세션 없음 → inactive (잠글 대상이 없다)
 * 3. 모름 → loading (밸브가 열리면 호출부가 unreadable로 바꿔 준다)
 * 4. 못 읽음 → recovery (열지 않는다. 탈출구는 로그아웃)
 * 5. 잠금 꺼짐 → inactive (오버레이를 렌더하지 않는다 = 화면 트리 불변)
 * 6. 이번 포그라운드에서 이미 풀었음 → unlocked
 * 7. → locked
 */
export function resolveAppLockGateStatus(input: AppLockGateInput): AppLockGateStatus {
  if (input.pixelLockMode) return "inactive";
  if (!input.hasSession) return "inactive";
  if (input.recordStatus === "unknown") return "loading";
  if (input.recordStatus === "unreadable") return "recovery";
  if (!input.enabled) return "inactive";
  if (input.unlockedThisForeground) return "unlocked";
  return "locked";
}

/** 숫자 4자리만 통과. 공백·문자·길이 불일치는 전부 false. */
export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^[0-9]{${APP_LOCK_PIN_LENGTH}}$`).test(pin);
}

/** base64url(sha256(`${salt}:${pin}`)). 저장·검증이 같은 한 함수를 쓴다. */
export function hashPin(pin: string, salt: string): string {
  return toBase64Url(sha256(`${salt}:${pin}`));
}

/**
 * 새 잠금 기록. 솔트는 매번 새로 뽑으므로 같은 PIN이어도 해시가 다르다.
 * `randomBytes`는 테스트에서 결정적 솔트를 넣기 위한 주입점일 뿐, 앱은 기본값(PKCE와 같은
 * getRandomBytes)을 쓴다.
 */
export function createAppLockRecord(
  pin: string,
  randomBytes: (length: number) => Uint8Array = getRandomBytes
): AppLockRecord | null {
  if (!isValidPinFormat(pin)) return null;
  const salt = toBase64Url(randomBytes(APP_LOCK_SALT_BYTES));
  return {
    version: APP_LOCK_RECORD_VERSION,
    enabled: true,
    salt,
    hash: hashPin(pin, salt),
    failedCount: 0,
    lockedUntilMs: null
  };
}

/** 길이가 다른 문자열도 같은 비용으로 비교한다(타이밍 차이로 자릿수를 흘리지 않게). */
function constantTimeEquals(left: string, right: string): boolean {
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
}

export function verifyPin(record: AppLockRecord, pin: string): boolean {
  if (!isValidPinFormat(pin)) return false;
  return constantTimeEquals(record.hash, hashPin(pin, record.salt));
}

/**
 * 남은 대기 시간(ms). 0이면 지금 입력할 수 있다.
 *
 * 시계 되돌림 방어: `nowMs`가 과거로 가면 남은 시간이 **커진다**(잠금이 풀리지 않는다). 다만
 * 화면이 "9999초 남았어요" 같은 말을 하지 않도록 표시값은 상한(300초)으로 자른다.
 * 반대 방향(시계를 앞으로 돌려 대기를 건너뛰기)은 서버 시각이 없는 로컬 잠금의 일반 한계로
 * 수용한다(§6 위험 2).
 */
export function appLockRemainingLockMs(record: AppLockRecord | null, nowMs: number): number {
  if (!record || record.lockedUntilMs === null) return 0;
  const remaining = record.lockedUntilMs - nowMs;
  if (remaining <= 0) return 0;
  return Math.min(remaining, APP_LOCK_LOCKOUT_MAX_MS);
}

export function isAppLockLockedOut(record: AppLockRecord | null, nowMs: number): boolean {
  return appLockRemainingLockMs(record, nowMs) > 0;
}

/** 남은 대기 초(올림). 0초로 보이는 순간이 없도록 1초 미만도 1로 올린다. */
export function appLockRemainingLockSeconds(record: AppLockRecord | null, nowMs: number): number {
  return Math.ceil(appLockRemainingLockMs(record, nowMs) / 1000);
}

/**
 * 실패 1회 기록. 5회째마다 대기를 세운다(30 → 60 → 300초, 이후 300초 유지).
 * 대기가 걸리지 않는 실패에서는 기존 lockedUntilMs를 건드리지 않는다.
 */
export function registerFailedAttempt(record: AppLockRecord, nowMs: number): AppLockRecord {
  const failedCount = record.failedCount + 1;
  if (failedCount % APP_LOCK_MAX_ATTEMPTS !== 0) {
    return { ...record, failedCount };
  }
  const stepIndex = Math.min(
    Math.floor(failedCount / APP_LOCK_MAX_ATTEMPTS) - 1,
    APP_LOCK_LOCKOUT_STEPS_MS.length - 1
  );
  return { ...record, failedCount, lockedUntilMs: nowMs + APP_LOCK_LOCKOUT_STEPS_MS[stepIndex] };
}

/** 성공했을 때. 카운터와 대기를 함께 비운다. */
export function clearFailedAttempts(record: AppLockRecord): AppLockRecord {
  if (record.failedCount === 0 && record.lockedUntilMs === null) return record;
  return { ...record, failedCount: 0, lockedUntilMs: null };
}

/**
 * 포그라운드로 돌아왔을 때 다시 잠글 것인가(§2.6).
 * - 백그라운드로 간 적이 없으면(null) 잠그지 않는다.
 * - 시계가 과거로 갔다면(음수 경과) 안전한 쪽으로 잠근다.
 */
export function shouldLockOnForeground(input: { backgroundedAtMs: number | null; nowMs: number }): boolean {
  if (input.backgroundedAtMs === null) return false;
  const elapsed = input.nowMs - input.backgroundedAtMs;
  if (elapsed < 0) return true;
  return elapsed >= APP_LOCK_GRACE_MS;
}

/** 저장 blob 방어(notification-preferences.store.ts의 sanitize 관례). 살릴 수 없으면 null. */
export function sanitizeAppLockRecord(value: unknown): AppLockRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== APP_LOCK_RECORD_VERSION) return null;
  if (typeof candidate.enabled !== "boolean") return null;
  if (typeof candidate.salt !== "string" || candidate.salt.length === 0) return null;
  if (typeof candidate.hash !== "string" || candidate.hash.length === 0) return null;
  const failedCount =
    typeof candidate.failedCount === "number" && Number.isFinite(candidate.failedCount)
      ? Math.max(0, Math.floor(candidate.failedCount))
      : 0;
  const lockedUntilMs =
    typeof candidate.lockedUntilMs === "number" && Number.isFinite(candidate.lockedUntilMs)
      ? candidate.lockedUntilMs
      : null;
  return {
    version: APP_LOCK_RECORD_VERSION,
    enabled: candidate.enabled,
    salt: candidate.salt,
    hash: candidate.hash,
    failedCount,
    lockedUntilMs
  };
}

/** 저장된 문자열 → 기록. 손상 JSON은 null이다(호출부가 "못 읽음"으로 다룬다). */
export function parseAppLockRecord(raw: string): AppLockRecord | null {
  try {
    return sanitizeAppLockRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function serializeAppLockRecord(record: AppLockRecord): string {
  return JSON.stringify(record);
}

/* ------------------------------------------------------------------------------------------ */
/* 문구 — 해요체(DNC-018), 책망·불안 금지, 이 빌드에 없는 해제 수단 언급 금지(수용 기준 10·11). */
/* ------------------------------------------------------------------------------------------ */

export const APP_LOCK_TITLE = "앱 잠금";

/** 잠금 화면(오버레이) 상태별 문구. loading은 콜드 스타트 홀딩 뷰의 문구를 그대로 재사용한다. */
export const APP_LOCK_COPY = {
  loading: {
    title: COLD_START_HOLD_TITLE,
    body: COLD_START_HOLD_COPY.hydration.body
  },
  locked: {
    title: "PIN을 입력해 주세요",
    body: "이 기기에서 앱을 열려면 PIN 4자리가 필요해요."
  },
  recovery: {
    title: "잠금 정보를 읽지 못했어요",
    body: "안전을 위해 잠긴 상태로 두었어요. 아래에서 로그아웃한 뒤 다시 로그인하면 계속 이용할 수 있어요."
  }
} as const;

export const APP_LOCK_PIN_INPUT_LABEL = "PIN 4자리";

/**
 * 이 잠금이 무엇을 막고 무엇을 막지 못하는가(§2.6·수용 기준 11). 설정 화면과 잠금 화면이
 * 같은 문장을 쓴다 — "완전한 보호"를 주장하지 않는다.
 */
export const APP_LOCK_SCOPE_NOTICE =
  "잠깐 폰을 빌려준 사이에 기록이 보이는 것을 막아 줘요. 기기 전체나 계정을 보호하는 기능은 아니에요.";

export const APP_LOCK_FORGOT_PIN_LABEL = "PIN을 잊으셨나요?";
export const APP_LOCK_FORGOT_PIN_TITLE = "로그아웃하고 다시 시작할까요?";

/**
 * PIN 분실 경로의 정직 고지 2줄(§2.6·수용 기준 7).
 *
 * 두 번째 줄이 핵심이다: `clearSession("logout")`은 userId를 null로 만들고, 그 전이가 PRIV-104
 * teardown을 발화시켜 mutation_outbox를 통째로 지운다(src/offline/session-teardown.ts). 아직
 * 서버에 올라가지 않은 기록은 그때 사라진다 — 이 사실을 감추면 허위 안내다.
 */
export const APP_LOCK_LOGOUT_KEEPS_SERVER_DATA_NOTICE = "기록은 서버에 있어서 다시 로그인하면 그대로 볼 수 있어요.";
export const APP_LOCK_LOGOUT_UNSYNCED_LOSS_NOTICE = "아직 서버에 올라가지 않은 기록은 로그아웃할 때 사라져요.";
export const APP_LOCK_FORGOT_PIN_MESSAGE = `${APP_LOCK_LOGOUT_KEEPS_SERVER_DATA_NOTICE}\n${APP_LOCK_LOGOUT_UNSYNCED_LOSS_NOTICE}`;

/**
 * 설정 화면의 수동 잠금(GAP-058 #3).
 *
 * 이 잠금의 위협 모델은 "잠깐 폰을 빌려줄 때" 하나인데(APP_LOCK_SCOPE_NOTICE), 지금까지 잠그는
 * 길은 앱을 60초 넘게 백그라운드에 두는 것뿐이었다 — 폰을 건네기 직전에 잠글 수단이 없었다.
 */
export const APP_LOCK_LOCK_NOW_LABEL = "지금 잠그기";
export const APP_LOCK_LOCK_NOW_A11Y_LABEL = "지금 잠그기, 바로 PIN 입력 화면으로 잠가요";
export const APP_LOCK_LOCK_NOW_HINT = "폰을 잠깐 건네주기 전에 눌러요. 다시 열려면 PIN이 필요해요.";

export const APP_LOCK_PIN_FORMAT_NOTICE = "숫자 4자리로 입력해 주세요.";
export const APP_LOCK_PIN_MISMATCH_NOTICE = "두 번 입력한 PIN이 서로 달라요. 다시 입력해 주세요.";
export const APP_LOCK_SAVE_FAILED_NOTICE = "잠금을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** 대기 중 안내. "N초 남았어요"까지 말해 준다(수용 기준 5). */
export function appLockLockoutNotice(remainingSeconds: number): string {
  return `잠시 후 다시 시도할 수 있어요. ${remainingSeconds}초 남았어요.`;
}

/**
 * 대기가 **끝난 순간**의 안내(GAP-058 P3).
 *
 * 남은 시간이 0이 되면 화면은 이미 입력을 받는데 문구만 "N초 남았어요"에 멈춰 있으면 그 문구가
 * 거짓이 된다 — 사용자는 기다릴 필요가 없는데 기다린다. 그래서 0에 닿는 순간 이 문장으로 바꾼다.
 */
export const APP_LOCK_LOCKOUT_CLEARED_NOTICE = "이제 다시 입력할 수 있어요.";

/** 오답 안내 한 틀. 앞머리만 다르고(어느 PIN이 틀렸는지) 나머지 판정은 한 곳이다. */
function wrongPinNotice(lead: string, record: AppLockRecord, nowMs: number): string {
  const remainingSeconds = appLockRemainingLockSeconds(record, nowMs);
  if (remainingSeconds > 0) return appLockLockoutNotice(remainingSeconds);
  const remainingAttempts = APP_LOCK_MAX_ATTEMPTS - (record.failedCount % APP_LOCK_MAX_ATTEMPTS);
  return `${lead} ${remainingAttempts}번 더 틀리면 잠시 기다려야 해요.`;
}

/**
 * 틀렸을 때의 안내. 남은 횟수를 말해 주되 책망하지 않는다.
 * 대기가 걸린 상태면 위 대기 문구가 우선한다.
 */
export function appLockWrongPinNotice(record: AppLockRecord, nowMs: number): string {
  return wrongPinNotice("PIN이 맞지 않아요.", record, nowMs);
}

/**
 * 설정 화면(두 번째 입구)의 오답 안내 — 폼에 PIN 입력칸이 셋이라 어느 것이 틀렸는지 밝힌다.
 *
 * 남은 횟수는 잠금 화면과 **같은** 카운터에서 온다(GAP-058 #2). 입구가 둘이라고 시도 예산이
 * 두 배가 되면 5회 제한이 사실상 10회가 된다.
 */
export function appLockWrongCurrentPinNotice(record: AppLockRecord, nowMs: number): string {
  return wrongPinNotice("지금 쓰는 PIN이 맞지 않아요.", record, nowMs);
}
