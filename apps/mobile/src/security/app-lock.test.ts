import { describe, expect, it } from "vitest";
import { COLD_START_HOLD_TITLE } from "../onboarding/cold-start-hold";
import { NOTIFICATION_HYDRATION_VALVE_MS } from "../notifications/useHomeNotificationEvaluation";
import {
  APP_LOCK_COPY,
  APP_LOCK_FORGOT_PIN_MESSAGE,
  APP_LOCK_GRACE_MS,
  APP_LOCK_LOCKOUT_MAX_MS,
  APP_LOCK_LOGOUT_KEEPS_SERVER_DATA_NOTICE,
  APP_LOCK_LOGOUT_UNSYNCED_LOSS_NOTICE,
  APP_LOCK_MAX_ATTEMPTS,
  APP_LOCK_SCOPE_NOTICE,
  APP_LOCK_VALVE_MS,
  appLockLockoutNotice,
  appLockRemainingLockMs,
  appLockRemainingLockSeconds,
  appLockWrongPinNotice,
  clearFailedAttempts,
  createAppLockRecord,
  hashPin,
  isAppLockLockedOut,
  isValidPinFormat,
  parseAppLockRecord,
  registerFailedAttempt,
  resolveAppLockGateStatus,
  sanitizeAppLockRecord,
  serializeAppLockRecord,
  shouldLockOnForeground,
  verifyPin,
  type AppLockGateInput,
  type AppLockRecord
} from "./app-lock";

/**
 * 라운드 55 트랙 B — 앱 잠금 순수 판정 단위 테스트 (docs/5차/round55-plan.md §4).
 * 수용 기준 §2.9의 각 항목을 여기(순수)와 app-lock-gate-contract.test.ts(소스 계약)로 나눠 고정한다.
 */

const NOW = Date.UTC(2026, 7, 28, 3, 0, 0);

function record(overrides: Partial<AppLockRecord> = {}): AppLockRecord {
  const base = createAppLockRecord("1234", (length) => Uint8Array.from({ length }, (_, index) => index));
  expect(base).not.toBeNull();
  return { ...(base as AppLockRecord), ...overrides };
}

describe("PIN 형식·해시", () => {
  it("숫자 4자리만 통과한다", () => {
    expect(isValidPinFormat("1234")).toBe(true);
    expect(isValidPinFormat("0000")).toBe(true);
    expect(isValidPinFormat("123")).toBe(false);
    expect(isValidPinFormat("12345")).toBe(false);
    expect(isValidPinFormat("12a4")).toBe(false);
    expect(isValidPinFormat("12 4")).toBe(false);
    expect(isValidPinFormat(" 1234")).toBe(false);
    expect(isValidPinFormat("")).toBe(false);
    // 전각 숫자·부호도 막는다(숫자처럼 보이는 문자로 우회하지 못하게).
    expect(isValidPinFormat("１２３４")).toBe(false);
    expect(isValidPinFormat("+123")).toBe(false);
  });

  it("해시 왕복: 맞는 PIN만 통과하고, 오답·형식 오류는 막힌다", () => {
    const stored = record();
    expect(verifyPin(stored, "1234")).toBe(true);
    expect(verifyPin(stored, "4321")).toBe(false);
    expect(verifyPin(stored, "123")).toBe(false);
    expect(verifyPin(stored, "")).toBe(false);
  });

  it("솔트가 매번 다르므로 같은 PIN이어도 저장되는 해시가 다르다", () => {
    const first = createAppLockRecord("1234");
    const second = createAppLockRecord("1234");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first!.salt).not.toEqual(second!.salt);
    expect(first!.hash).not.toEqual(second!.hash);
    // 그래도 둘 다 자기 PIN을 검증한다.
    expect(verifyPin(first!, "1234")).toBe(true);
    expect(verifyPin(second!, "1234")).toBe(true);
  });

  it("해시는 솔트와 PIN 둘 다에 의존한다 (평문 PIN은 어디에도 없다)", () => {
    expect(hashPin("1234", "salt-a")).not.toEqual(hashPin("1234", "salt-b"));
    expect(hashPin("1234", "salt-a")).not.toEqual(hashPin("4321", "salt-a"));
    expect(hashPin("1234", "salt-a")).toEqual(hashPin("1234", "salt-a"));
    const stored = record();
    expect(serializeAppLockRecord(stored)).not.toContain("1234");
  });

  it("형식이 틀린 PIN으로는 기록 자체가 만들어지지 않는다", () => {
    expect(createAppLockRecord("12")).toBeNull();
    expect(createAppLockRecord("abcd")).toBeNull();
    expect(record().enabled).toBe(true);
  });
});

describe("실패 지연 (수용 기준 5)", () => {
  it("5회 연속 실패에 30초, 10회에 60초, 15회에 300초, 그 뒤로는 300초 상한", () => {
    let current = record();
    for (let attempt = 1; attempt <= 4; attempt++) {
      current = registerFailedAttempt(current, NOW);
      expect(current.lockedUntilMs, `${attempt}회에는 대기가 없다`).toBeNull();
    }
    current = registerFailedAttempt(current, NOW);
    expect(current.failedCount).toBe(APP_LOCK_MAX_ATTEMPTS);
    expect(current.lockedUntilMs).toBe(NOW + 30_000);

    for (let attempt = 6; attempt <= 10; attempt++) current = registerFailedAttempt(current, NOW);
    expect(current.lockedUntilMs).toBe(NOW + 60_000);

    for (let attempt = 11; attempt <= 15; attempt++) current = registerFailedAttempt(current, NOW);
    expect(current.lockedUntilMs).toBe(NOW + 300_000);

    for (let attempt = 16; attempt <= 20; attempt++) current = registerFailedAttempt(current, NOW);
    expect(current.lockedUntilMs).toBe(NOW + 300_000);
    expect(APP_LOCK_LOCKOUT_MAX_MS).toBe(300_000);
  });

  it("대기가 만료되면 다시 입력할 수 있다", () => {
    const locked = registerFailedAttempt({ ...record(), failedCount: 4 }, NOW);
    expect(isAppLockLockedOut(locked, NOW)).toBe(true);
    expect(appLockRemainingLockSeconds(locked, NOW)).toBe(30);
    expect(appLockRemainingLockSeconds(locked, NOW + 29_500)).toBe(1);
    expect(isAppLockLockedOut(locked, NOW + 30_000)).toBe(false);
    expect(appLockRemainingLockMs(locked, NOW + 30_001)).toBe(0);
  });

  it("시계를 과거로 돌려도 대기가 풀리지 않는다 (표시값만 상한으로 자른다)", () => {
    const locked = registerFailedAttempt({ ...record(), failedCount: 4 }, NOW);
    const rolledBack = NOW - 7 * 24 * 60 * 60 * 1000;
    expect(isAppLockLockedOut(locked, rolledBack)).toBe(true);
    expect(appLockRemainingLockMs(locked, rolledBack)).toBe(APP_LOCK_LOCKOUT_MAX_MS);
  });

  it("성공하면 카운터와 대기가 함께 비워진다", () => {
    const locked = registerFailedAttempt({ ...record(), failedCount: 4 }, NOW);
    const cleared = clearFailedAttempts(locked);
    expect(cleared.failedCount).toBe(0);
    expect(cleared.lockedUntilMs).toBeNull();
    // 이미 깨끗하면 같은 객체를 그대로 돌려준다(불필요한 저장을 만들지 않는다).
    expect(clearFailedAttempts(cleared)).toBe(cleared);
  });

  it("대기가 없는 기록·null 기록은 잠겨 있지 않다", () => {
    expect(isAppLockLockedOut(record(), NOW)).toBe(false);
    expect(isAppLockLockedOut(null, NOW)).toBe(false);
    expect(appLockRemainingLockSeconds(null, NOW)).toBe(0);
  });
});

describe("백그라운드 유예 (수용 기준 4)", () => {
  it("60초 경계: 59초는 잠기지 않고, 60초·61초는 잠긴다", () => {
    expect(APP_LOCK_GRACE_MS).toBe(60_000);
    expect(shouldLockOnForeground({ backgroundedAtMs: NOW, nowMs: NOW + 59_000 })).toBe(false);
    expect(shouldLockOnForeground({ backgroundedAtMs: NOW, nowMs: NOW + 59_999 })).toBe(false);
    expect(shouldLockOnForeground({ backgroundedAtMs: NOW, nowMs: NOW + 60_000 })).toBe(true);
    expect(shouldLockOnForeground({ backgroundedAtMs: NOW, nowMs: NOW + 61_000 })).toBe(true);
  });

  it("백그라운드로 간 적이 없으면 잠그지 않고, 시계가 뒤로 갔으면 안전한 쪽으로 잠근다", () => {
    expect(shouldLockOnForeground({ backgroundedAtMs: null, nowMs: NOW })).toBe(false);
    expect(shouldLockOnForeground({ backgroundedAtMs: NOW, nowMs: NOW - 1 })).toBe(true);
  });
});

describe("게이트 상태표 (§2.4 7분기 전수)", () => {
  const base: AppLockGateInput = {
    pixelLockMode: false,
    hasSession: true,
    recordStatus: "loaded",
    enabled: true,
    unlockedThisForeground: false
  };

  it("1. 픽셀락이면 무조건 inactive (캡처 경로 불변 — 수용 기준 6)", () => {
    expect(resolveAppLockGateStatus({ ...base, pixelLockMode: true })).toBe("inactive");
    // 다른 어떤 값이어도 픽셀락이 이긴다.
    expect(
      resolveAppLockGateStatus({ ...base, pixelLockMode: true, recordStatus: "unreadable", hasSession: true })
    ).toBe("inactive");
  });

  it("2. 세션이 없으면 inactive (로그인·스플래시는 잠그지 않는다)", () => {
    expect(resolveAppLockGateStatus({ ...base, hasSession: false })).toBe("inactive");
    expect(resolveAppLockGateStatus({ ...base, hasSession: false, recordStatus: "unreadable" })).toBe("inactive");
  });

  it("3. 아직 모르면 loading, 4. 못 읽으면 recovery (밸브가 닫히는 방향)", () => {
    expect(resolveAppLockGateStatus({ ...base, recordStatus: "unknown" })).toBe("loading");
    expect(resolveAppLockGateStatus({ ...base, recordStatus: "unreadable" })).toBe("recovery");
    // "모르면 진행"이 아니다 — unknown/unreadable 어느 쪽도 inactive/unlocked가 되지 않는다.
    expect(resolveAppLockGateStatus({ ...base, recordStatus: "unknown", enabled: false })).toBe("loading");
    expect(
      resolveAppLockGateStatus({ ...base, recordStatus: "unreadable", unlockedThisForeground: true })
    ).toBe("recovery");
  });

  it("5. PIN 미설정이면 inactive (수용 기준 2)", () => {
    expect(resolveAppLockGateStatus({ ...base, enabled: false })).toBe("inactive");
  });

  it("6. 이번 포그라운드에서 풀었으면 unlocked, 7. 아니면 locked (수용 기준 3)", () => {
    expect(resolveAppLockGateStatus({ ...base, unlockedThisForeground: true })).toBe("unlocked");
    expect(resolveAppLockGateStatus(base)).toBe("locked");
  });
});

describe("저장 blob 방어", () => {
  it("정상 기록은 왕복한다", () => {
    const stored = record({ failedCount: 3, lockedUntilMs: NOW });
    expect(parseAppLockRecord(serializeAppLockRecord(stored))).toEqual(stored);
  });

  it("손상 JSON·모르는 버전·필드 누락은 null이다", () => {
    expect(parseAppLockRecord("{not json")).toBeNull();
    expect(parseAppLockRecord("null")).toBeNull();
    expect(parseAppLockRecord('"1234"')).toBeNull();
    expect(sanitizeAppLockRecord({ ...record(), version: 2 })).toBeNull();
    expect(sanitizeAppLockRecord({ ...record(), salt: "" })).toBeNull();
    expect(sanitizeAppLockRecord({ ...record(), hash: 42 })).toBeNull();
    expect(sanitizeAppLockRecord({ ...record(), enabled: "yes" })).toBeNull();
    expect(sanitizeAppLockRecord(undefined)).toBeNull();
  });

  it("살릴 수 있는 값은 살리되 카운터·대기는 방어적으로 정리한다", () => {
    const messy = sanitizeAppLockRecord({ ...record(), failedCount: -3, lockedUntilMs: "곧" });
    expect(messy?.failedCount).toBe(0);
    expect(messy?.lockedUntilMs).toBeNull();
    const fractional = sanitizeAppLockRecord({ ...record(), failedCount: 2.7 });
    expect(fractional?.failedCount).toBe(2);
  });
});

describe("문구 (DNC-018 · 수용 기준 7·10·11)", () => {
  it("loading 문구는 콜드 스타트 홀딩 뷰의 것을 그대로 재사용한다 (§2.5)", () => {
    expect(APP_LOCK_COPY.loading.title).toBe(COLD_START_HOLD_TITLE);
  });

  it("밸브 상한이 저장소의 다른 밸브와 같은 3000ms다", () => {
    expect(APP_LOCK_VALVE_MS).toBe(3000);
    expect(APP_LOCK_VALVE_MS).toBe(NOTIFICATION_HYDRATION_VALVE_MS);
  });

  it("PIN 분실 안내가 미동기화 기록 소실을 사전에 말한다", () => {
    expect(APP_LOCK_FORGOT_PIN_MESSAGE).toContain(APP_LOCK_LOGOUT_KEEPS_SERVER_DATA_NOTICE);
    expect(APP_LOCK_FORGOT_PIN_MESSAGE).toContain(APP_LOCK_LOGOUT_UNSYNCED_LOSS_NOTICE);
    expect(APP_LOCK_LOGOUT_UNSYNCED_LOSS_NOTICE).toContain("아직 서버에 올라가지 않은 기록");
    expect(APP_LOCK_LOGOUT_UNSYNCED_LOSS_NOTICE).toContain("사라져요");
  });

  it("범위 고지가 '완전한 보호'를 주장하지 않는다", () => {
    expect(APP_LOCK_SCOPE_NOTICE).toContain("기기 전체나 계정을 보호하는 기능은 아니에요");
    for (const copy of [APP_LOCK_SCOPE_NOTICE, APP_LOCK_COPY.locked.body, APP_LOCK_COPY.recovery.body]) {
      expect(copy).not.toContain("완전");
      expect(copy).not.toContain("안전하게 보호");
    }
  });

  it("모든 문구가 해요체이고, 없는 기능(생체 인증)을 말하지 않는다", () => {
    const all = [
      APP_LOCK_COPY.locked.title,
      APP_LOCK_COPY.locked.body,
      APP_LOCK_COPY.recovery.title,
      APP_LOCK_COPY.recovery.body,
      APP_LOCK_SCOPE_NOTICE,
      APP_LOCK_FORGOT_PIN_MESSAGE,
      appLockLockoutNotice(30),
      appLockWrongPinNotice(record({ failedCount: 1 }), NOW)
    ];
    for (const copy of all) {
      expect(copy).not.toMatch(/지문|얼굴|생체|Face|Touch/i);
      // 책망·불안 문구 금지(record_gap 톤 규율).
      expect(copy).not.toMatch(/왜|잘못했|주의하세요|위험합니다/);
      expect(copy.endsWith("요.") || copy.endsWith("요") || copy.includes("요.")).toBe(true);
    }
  });

  it("대기·오답 안내가 남은 시간·남은 횟수를 그대로 말한다", () => {
    expect(appLockLockoutNotice(30)).toContain("30초 남았어요");
    const afterOne = registerFailedAttempt(record(), NOW);
    expect(appLockWrongPinNotice(afterOne, NOW)).toContain("4번 더");
    const afterFour = { ...record(), failedCount: 4 };
    expect(appLockWrongPinNotice(afterFour, NOW)).toContain("1번 더");
    // 대기가 걸린 상태에서는 남은 횟수 대신 대기 안내가 우선한다.
    const locked = registerFailedAttempt(afterFour, NOW);
    expect(appLockWrongPinNotice(locked, NOW)).toBe(appLockLockoutNotice(30));
  });
});
