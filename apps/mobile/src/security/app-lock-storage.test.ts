import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppLockRecord, serializeAppLockRecord, type AppLockRecord } from "./app-lock";

/**
 * 라운드 55 트랙 B — 잠금 저장소 (docs/5차/round55-plan.md §2.3·§4).
 *
 * expo-secure-store 모킹 관례는 src/stores/secure-session-storage.test.ts를 그대로 따른다:
 * vi.resetModules()로 모듈 그래프를 새로 만들고, 네이티브 모듈은 테스트가 소유한 Map으로
 * 대체한다(그 Map은 resetModules를 넘어 살아남으므로 "앱 강제 종료 후 재실행"을 모사한다).
 */

function loadStorage() {
  return import("./app-lock-storage");
}

function fixedRecord(overrides: Partial<AppLockRecord> = {}): AppLockRecord {
  const base = createAppLockRecord("1234", (length) => Uint8Array.from({ length }, (_, index) => index));
  return { ...(base as AppLockRecord), ...overrides };
}

describe("app-lock-storage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("expo-secure-store");
  });

  it("SecureStore 키 이름이 문자 제약(영숫자·. - _)을 지킨다", async () => {
    const { APP_LOCK_STORAGE_KEY } = await loadStorage();
    expect(APP_LOCK_STORAGE_KEY).toBe("wooriai-app-lock");
    expect(APP_LOCK_STORAGE_KEY).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  describe("네이티브 모듈이 없는 환경 (web · vitest/node)", () => {
    it("인메모리 폴백으로 왕복하고, 기록이 없으면 loaded/null이다", async () => {
      const { readAppLockRecord, writeAppLockRecord, clearAppLockRecord } = await loadStorage();

      expect(await readAppLockRecord()).toEqual({ status: "loaded", record: null });

      const stored = fixedRecord();
      expect(await writeAppLockRecord(stored)).toBe(true);
      expect(await readAppLockRecord()).toEqual({ status: "loaded", record: stored });

      await clearAppLockRecord();
      expect(await readAppLockRecord()).toEqual({ status: "loaded", record: null });
    });
  });

  describe("SecureStore가 있는 환경", () => {
    it("한 키에 전량을 담고, 그 키를 다시 읽어 낸다", async () => {
      const store = new Map<string, string>();
      vi.doMock("expo-secure-store", () => ({
        getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
        setItemAsync: vi.fn(async (key: string, value: string) => {
          store.set(key, value);
        }),
        deleteItemAsync: vi.fn(async (key: string) => {
          store.delete(key);
        })
      }));
      const SecureStore = await import("expo-secure-store");
      const { APP_LOCK_STORAGE_KEY, readAppLockRecord, writeAppLockRecord } = await loadStorage();

      const stored = fixedRecord({ failedCount: 2 });
      expect(await writeAppLockRecord(stored)).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(APP_LOCK_STORAGE_KEY, serializeAppLockRecord(stored));
      // 키는 하나뿐이다 — AsyncStorage 쪽에 나뉘어 저장되는 값이 없다(§2.3의 합성 구멍 방지).
      expect([...store.keys()]).toEqual([APP_LOCK_STORAGE_KEY]);
      expect(await readAppLockRecord()).toEqual({ status: "loaded", record: stored });
      // 평문 PIN이 저장되지 않는다(DNC-019).
      expect(store.get(APP_LOCK_STORAGE_KEY)).not.toContain("1234");
    });

    it("실패 카운터·대기 시각이 앱 재시작(모듈 그래프 재생성)을 넘어 유지된다 (수용 기준 5)", async () => {
      const store = new Map<string, string>();
      const secureStoreMock = () => ({
        getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
        setItemAsync: vi.fn(async (key: string, value: string) => {
          store.set(key, value);
        }),
        deleteItemAsync: vi.fn(async (key: string) => {
          store.delete(key);
        })
      });

      vi.doMock("expo-secure-store", secureStoreMock);
      const first = await loadStorage();
      const lockedUntilMs = Date.UTC(2026, 7, 28, 3, 0, 30);
      await first.writeAppLockRecord(fixedRecord({ failedCount: 5, lockedUntilMs }));

      // "앱을 죽였다 켠다": 모듈 그래프는 새로 만들되 기기의 SecureStore(=store Map)는 그대로.
      vi.resetModules();
      vi.doMock("expo-secure-store", secureStoreMock);
      const second = await loadStorage();
      const result = await second.readAppLockRecord();
      expect(result.status).toBe("loaded");
      expect(result.status === "loaded" ? result.record?.failedCount : null).toBe(5);
      expect(result.status === "loaded" ? result.record?.lockedUntilMs : null).toBe(lockedUntilMs);
    });

    it("읽기가 실패하면 unreadable이다 — '잠금 없음'으로 넘기지 않는다", async () => {
      vi.doMock("expo-secure-store", () => ({
        getItemAsync: vi.fn(async () => {
          throw new Error("keystore unavailable");
        }),
        setItemAsync: vi.fn(async () => undefined),
        deleteItemAsync: vi.fn(async () => undefined)
      }));
      const { readAppLockRecord } = await loadStorage();
      expect(await readAppLockRecord()).toEqual({ status: "unreadable" });
    });

    it("손상된 블롭도 unreadable이다 (있었는지 없었는지 모른다)", async () => {
      const store = new Map<string, string>([["wooriai-app-lock", "{not json"]]);
      vi.doMock("expo-secure-store", () => ({
        getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
        setItemAsync: vi.fn(async () => undefined),
        deleteItemAsync: vi.fn(async () => undefined)
      }));
      const { readAppLockRecord } = await loadStorage();
      expect(await readAppLockRecord()).toEqual({ status: "unreadable" });
    });

    it("쓰기 실패를 삼키지 않는다 (설정 화면이 '켰어요'라고 말하지 못하게)", async () => {
      vi.doMock("expo-secure-store", () => ({
        getItemAsync: vi.fn(async () => null),
        setItemAsync: vi.fn(async () => {
          throw new Error("write failed");
        }),
        deleteItemAsync: vi.fn(async () => undefined)
      }));
      const { writeAppLockRecord } = await loadStorage();
      expect(await writeAppLockRecord(fixedRecord())).toBe(false);
    });

    it("삭제는 그 키만 지우고, 네이티브 오류를 밖으로 던지지 않는다 (PRIV-104 합류점)", async () => {
      const store = new Map<string, string>();
      vi.doMock("expo-secure-store", () => ({
        getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
        setItemAsync: vi.fn(async (key: string, value: string) => {
          store.set(key, value);
        }),
        deleteItemAsync: vi.fn(async (key: string) => {
          store.delete(key);
          throw new Error("delete reported an error");
        })
      }));
      const { clearAppLockRecord, readAppLockRecord, writeAppLockRecord } = await loadStorage();
      await writeAppLockRecord(fixedRecord());
      await expect(clearAppLockRecord()).resolves.toBeUndefined();
      expect(await readAppLockRecord()).toEqual({ status: "loaded", record: null });
    });
  });
});
