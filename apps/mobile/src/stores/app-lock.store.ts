import { create } from "zustand";
import {
  APP_LOCK_VALVE_MS,
  appLockRemainingLockMs,
  clearFailedAttempts,
  createAppLockRecord,
  isValidPinFormat,
  registerFailedAttempt,
  shouldLockOnForeground,
  verifyPin,
  type AppLockRecord,
  type AppLockRecordStatus
} from "../security/app-lock";
import { clearAppLockRecord, readAppLockRecord, writeAppLockRecord } from "../security/app-lock-storage";

/**
 * 라운드 55 트랙 B — 앱 잠금 런타임 상태 (docs/5차/round55-plan.md §2.3).
 *
 * **persist 미들웨어를 쓰지 않는다.** 저장되는 값은 전부 SecureStore 한 키에 있고
 * (src/security/app-lock-storage.ts), 이 스토어가 들고 있는 것은 부팅 이후의 런타임 상태뿐이다:
 * 지금 기록을 읽었는가(`recordStatus`), 읽은 기록(`record`), 이번 포그라운드에서 이미 풀었는가
 * (`unlockedThisForeground`), 언제 백그라운드로 갔는가(`backgroundedAtMs`).
 *
 * `unlockedThisForeground`가 persist되면 안 되는 이유는 그 자체다 — 앱을 껐다 켜면 다시
 * 물어야 한다(수용 기준 3). 반대로 실패 카운터·대기 시각은 반드시 저장돼야 한다(수용 기준 5:
 * 강제 종료로 대기를 우회할 수 없다) — 그래서 그 둘만 SecureStore 쪽에 산다.
 *
 * AppState 구독은 여기 없다. 네이티브 구독은 subscribeAppStateChange 한 곳에서만 등록하는
 * 규율(FIX-118A)이 있어 오버레이 컴포넌트가 그것을 통해 이 스토어의 note* 액션을 부른다
 * (src/security/AppLockOverlay.tsx).
 */

/** 잠금 설정/변경/해제 시도의 결과. 화면은 이 값으로 문구를 고른다. */
export type AppLockMutationResult = "ok" | "invalid-format" | "wrong-pin" | "save-failed";

/** 잠금 화면의 PIN 제출 결과. */
export type AppLockSubmitResult = "unlocked" | "wrong-pin" | "invalid-format" | "locked-out" | "no-record";

export type AppLockState = {
  recordStatus: AppLockRecordStatus;
  record: AppLockRecord | null;
  /** 이번 포그라운드에서 PIN을 통과했는가. 콜드 스타트에서는 항상 false. */
  unlockedThisForeground: boolean;
  /** 마지막으로 백그라운드로 간 시각(epoch ms). 포그라운드면 null. */
  backgroundedAtMs: number | null;

  /** 부팅 시 1회. SecureStore를 읽어 recordStatus를 확정한다(3초 밸브 포함). */
  load: () => Promise<void>;
  /** 잠금 켜기. 이미 켜져 있으면 PIN 변경은 changePin을 쓴다. */
  enableLock: (pin: string) => Promise<AppLockMutationResult>;
  changePin: (currentPin: string, nextPin: string) => Promise<AppLockMutationResult>;
  disableLock: (currentPin: string) => Promise<AppLockMutationResult>;
  /** 잠금 화면의 입력. 실패 카운터·대기는 SecureStore에 곧바로 반영된다. */
  submitPin: (pin: string, nowMs?: number) => Promise<AppLockSubmitResult>;
  noteBackgrounded: (nowMs?: number) => void;
  noteForegrounded: (nowMs?: number) => void;
  /** 지금 즉시 잠근다(테스트·수동 잠금용). */
  lockNow: () => void;
  /**
   * PRIV-104 teardown 합류 지점(§2.8) — 기록을 지우고 런타임 상태를 초기값으로 되돌린다.
   * 트랙 C가 src/offline/session-teardown.ts에서 부른다. 부르지 않으면 계정 전환 후 새
   * 사용자가 이전 사용자의 PIN 화면에 갇힌다(브릭).
   *
   * 런타임 상태는 **동기로** 비우고(다른 reset 4줄과 같은 자리에 그냥 놓을 수 있다),
   * SecureStore 삭제만 Promise로 돌려준다 — teardown이 이미 async이므로 await해 두면 삭제
   * 실패가 다음 부팅까지 남는 일을 줄일 수 있다.
   */
  resetAll: () => Promise<void>;
};

const initialAppLockState = {
  recordStatus: "unknown" as AppLockRecordStatus,
  record: null as AppLockRecord | null,
  unlockedThisForeground: false,
  backgroundedAtMs: null as number | null
};

export const useAppLockStore = create<AppLockState>()((set, get) => ({
  ...initialAppLockState,

  load: async () => {
    if (get().recordStatus !== "unknown") return;
    /**
     * §2.5 밸브 — **닫는 방향**이다. 읽기가 영영 돌아오지 않으면 3초 뒤 `unreadable`로 확정해
     * recovery(로그아웃 탈출구가 있는 화면)를 그린다. 다른 밸브들과 같은 3000ms를 쓴다.
     * 늦게라도 진짜 결과가 오면 그것을 받아들인다 — 실제로 읽어 낸 사실이 추측보다 낫다.
     */
    const valve = setTimeout(() => {
      if (useAppLockStore.getState().recordStatus === "unknown") {
        set({ recordStatus: "unreadable", record: null });
      }
    }, APP_LOCK_VALVE_MS);
    try {
      const result = await readAppLockRecord();
      if (result.status === "unreadable") {
        set({ recordStatus: "unreadable", record: null });
        return;
      }
      set({ recordStatus: "loaded", record: result.record });
    } finally {
      clearTimeout(valve);
    }
  },

  enableLock: async (pin) => {
    const record = createAppLockRecord(pin);
    if (!record) return "invalid-format";
    if (!(await writeAppLockRecord(record))) return "save-failed";
    // 방금 켠 사람은 지금 이 화면에 있다 — 켜자마자 자기 PIN을 다시 묻지 않는다.
    set({ recordStatus: "loaded", record, unlockedThisForeground: true, backgroundedAtMs: null });
    return "ok";
  },

  changePin: async (currentPin, nextPin) => {
    const current = get().record;
    if (!current || !current.enabled) return "wrong-pin";
    if (!verifyPin(current, currentPin)) return "wrong-pin";
    const next = createAppLockRecord(nextPin);
    if (!next) return "invalid-format";
    if (!(await writeAppLockRecord(next))) return "save-failed";
    set({ recordStatus: "loaded", record: next, unlockedThisForeground: true });
    return "ok";
  },

  disableLock: async (currentPin) => {
    const current = get().record;
    if (!current || !current.enabled) return "ok";
    if (!isValidPinFormat(currentPin)) return "invalid-format";
    if (!verifyPin(current, currentPin)) return "wrong-pin";
    await clearAppLockRecord();
    set({ recordStatus: "loaded", record: null, unlockedThisForeground: true, backgroundedAtMs: null });
    return "ok";
  },

  submitPin: async (pin, nowMs = Date.now()) => {
    const record = get().record;
    if (!record || !record.enabled) return "no-record";
    if (appLockRemainingLockMs(record, nowMs) > 0) return "locked-out";
    if (!isValidPinFormat(pin)) return "invalid-format";
    if (!verifyPin(record, pin)) {
      const failed = registerFailedAttempt(record, nowMs);
      set({ record: failed });
      // 저장에 실패해도 이번 세션의 카운터는 유지된다(위 set). 저장이 되면 강제 종료 후에도
      // 남는다 — 수용 기준 5가 요구하는 것은 그쪽이다.
      await writeAppLockRecord(failed);
      return "wrong-pin";
    }
    const cleared = clearFailedAttempts(record);
    set({ record: cleared, unlockedThisForeground: true, backgroundedAtMs: null });
    if (cleared !== record) await writeAppLockRecord(cleared);
    return "unlocked";
  },

  noteBackgrounded: (nowMs = Date.now()) => {
    // 이미 백그라운드로 간 시각이 있으면 덮어쓰지 않는다 — inactive → background처럼 한 번의
    // 이탈에서 두 번 불릴 수 있고, 나중 값으로 덮으면 유예가 그만큼 늘어난다.
    if (get().backgroundedAtMs !== null) return;
    set({ backgroundedAtMs: nowMs });
  },

  noteForegrounded: (nowMs = Date.now()) => {
    const { backgroundedAtMs } = get();
    if (shouldLockOnForeground({ backgroundedAtMs, nowMs })) {
      set({ unlockedThisForeground: false, backgroundedAtMs: null });
      return;
    }
    set({ backgroundedAtMs: null });
  },

  lockNow: () => set({ unlockedThisForeground: false, backgroundedAtMs: null }),

  resetAll: () => {
    // 기록을 지운 직후의 사실은 "잠금 없음"이다 — unknown으로 두면 다음 사용자가 이유 없이
    // loading/recovery를 본다.
    set({ ...initialAppLockState, recordStatus: "loaded" });
    return clearAppLockRecord();
  }
}));
