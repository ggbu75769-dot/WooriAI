/**
 * 라운드 55 트랙 B — 잠금 기록 저장소 (docs/5차/round55-plan.md §2.3).
 *
 * **SecureStore 단일 키.** zustand `persist`(AsyncStorage)를 쓰지 않는다.
 *
 * 이유(세션 합성 구멍): `secureSessionStorage.getItem`은 AsyncStorage가 null을 주면
 * **SecureStore의 토큰만으로 세션 봉투를 합성한다**(src/stores/secure-session-storage.ts:126-136).
 * 잠금 플래그를 AsyncStorage에 두면 그 조합에서 "세션은 살아 있는데 잠금은 꺼진 것으로 읽히는"
 * 구멍이 생긴다. 두 값을 같은 저장소에 두면 그 구멍이 원천적으로 없다 — 둘 다 못 읽으면 세션도
 * 없고, 세션이 없으면 잠글 대상도 없다.
 *
 * 모듈 로드 관례는 secure-session-storage.ts를 그대로 본뜬다: 정적 import 금지(네이티브 모듈이
 * 등록되지 않은 환경에서 모듈 평가 시점에 throw한다), 동적 import + catch, 인메모리 폴백.
 *
 * ⚠️ 세션 저장소와 **한 가지가 다르다**: 네이티브가 있는데 읽기/쓰기가 실패한 경우를 조용히
 * 메모리로 대체하지 않는다.
 * - 읽기 실패 → `{ status: "unreadable" }`. 잠금이 있는지 없는지 모른다는 뜻이고, 게이트는
 *   그것을 `recovery`로 닫는다(§2.5의 밸브 방향). 메모리 폴백으로 "잠금 없음"을 만들어 내면
 *   그게 곧 잠금 우회다.
 * - 쓰기 실패 → `false`. 설정 화면이 "켰어요"라고 말하지 못하게 한다(허위 표시 금지).
 * 네이티브 모듈 자체가 없는 환경(web·vitest/node)에서만 인메모리 맵을 쓴다 — 그 환경에서는
 * 세션 토큰도 같은 맵에 있으므로 위의 합성 구멍이 생기지 않는다.
 */
import { parseAppLockRecord, serializeAppLockRecord, type AppLockRecord } from "./app-lock";

/** SecureStore 키 이름 제약: 영숫자 · "." · "-" · "_"만. */
export const APP_LOCK_STORAGE_KEY = "wooriai-app-lock";

type SecureStoreModule = typeof import("expo-secure-store");

/** 네이티브 모듈이 아예 없는 환경(web, vitest/node)용 폴백. */
const memoryFallback = new Map<string, string>();

let secureStoreModulePromise: Promise<SecureStoreModule | null> | null = null;

function loadSecureStore(): Promise<SecureStoreModule | null> {
  if (!secureStoreModulePromise) {
    secureStoreModulePromise = import("expo-secure-store").catch(() => null);
  }
  return secureStoreModulePromise;
}

export type AppLockReadResult =
  /** 읽었다. `record`가 null이면 이 기기에는 잠금 기록이 없다(= 잠금 미설정). */
  | { status: "loaded"; record: AppLockRecord | null }
  /** 읽지 못했다(네이티브 오류 또는 손상된 블롭). 있는지 없는지 모른다. */
  | { status: "unreadable" };

export async function readAppLockRecord(): Promise<AppLockReadResult> {
  const SecureStore = await loadSecureStore();
  if (!SecureStore) {
    const raw = memoryFallback.get(APP_LOCK_STORAGE_KEY) ?? null;
    return { status: "loaded", record: raw === null ? null : parseAppLockRecord(raw) };
  }
  let raw: string | null;
  try {
    raw = (await SecureStore.getItemAsync(APP_LOCK_STORAGE_KEY)) ?? null;
  } catch {
    return { status: "unreadable" };
  }
  if (raw === null) return { status: "loaded", record: null };
  const record = parseAppLockRecord(raw);
  // 블롭은 있는데 살릴 수 없다 = 잠금이 있었는지 없었는지 모른다. "없다"로 넘기면 손상 하나로
  // 잠금이 풀린다 — 여기서도 닫는 쪽을 고른다.
  if (!record) return { status: "unreadable" };
  return { status: "loaded", record };
}

/** 저장 성공 여부를 그대로 돌려준다(실패를 삼키지 않는다). */
export async function writeAppLockRecord(record: AppLockRecord): Promise<boolean> {
  const value = serializeAppLockRecord(record);
  const SecureStore = await loadSecureStore();
  if (!SecureStore) {
    memoryFallback.set(APP_LOCK_STORAGE_KEY, value);
    return true;
  }
  try {
    await SecureStore.setItemAsync(APP_LOCK_STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 잠금 기록 삭제.
 *
 * PRIV-104 합류 지점(§2.8): 계정 정체성 변경(로그아웃·계정 전환) teardown이 이것을 부른다.
 * 부르지 않으면 A의 PIN이 남아 B가 그 잠금 화면에 갇히고, 탈출구는 로그아웃뿐이라 무한 루프가
 * 된다. 반대로 `clearSession("expired")`는 정체성을 유지하므로 PIN을 잃지 않는다 — 같은
 * 사람이다. (배선은 트랙 C: src/offline/session-teardown.ts)
 */
export async function clearAppLockRecord(): Promise<void> {
  memoryFallback.delete(APP_LOCK_STORAGE_KEY);
  const SecureStore = await loadSecureStore();
  if (!SecureStore) return;
  try {
    await SecureStore.deleteItemAsync(APP_LOCK_STORAGE_KEY);
  } catch {
    // 키가 애초에 없었던 경우 등 — 지울 것이 없으면 그대로 둔다.
  }
}
