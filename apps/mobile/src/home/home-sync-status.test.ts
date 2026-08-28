import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OFFLINE_STORAGE_UNAVAILABLE_NOTICE,
  OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE
} from "../offline/messages";
import { resolveHomeSyncStatus } from "./home-sync-status";

const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const counts = (partial: Partial<Parameters<typeof resolveHomeSyncStatus>[0] & object> = {}) => ({
  pending: 0,
  syncing: 0,
  failed: 0,
  conflict: 0,
  ...partial
});

describe("DSN-053 P2-A 홈 최하단 동기화 줄", () => {
  it("대기 중인 변경이 없으면 동기화 완료다", () => {
    expect(resolveHomeSyncStatus(counts())).toBe("synced");
  });

  it("확인이 필요한 충돌이 가장 먼저다(사용자가 할 일이 있는 쪽)", () => {
    expect(resolveHomeSyncStatus(counts({ conflict: 1, syncing: 2, pending: 3 }))).toBe("conflict");
  });

  it("전송 중이면 그 사실을 말한다", () => {
    expect(resolveHomeSyncStatus(counts({ syncing: 1, pending: 4 }))).toBe("syncing");
  });

  it("대기·실패는 같은 사실이다 -- 아직 서버에 반영되지 않았다", () => {
    expect(resolveHomeSyncStatus(counts({ pending: 1 }))).toBe("pending");
    expect(resolveHomeSyncStatus(counts({ failed: 1 }))).toBe("pending");
  });

  it("스냅숏이 아직 없으면 없는 문제를 만들지 않는다", () => {
    expect(resolveHomeSyncStatus(null)).toBe("synced");
    expect(resolveHomeSyncStatus(undefined)).toBe("synced");
  });

  it("'오프라인'은 만들지 않는다 -- 렌더 시점에 알 수 없는 사실을 단언하지 않는다", () => {
    const moduleSource = readFileSync(join(process.cwd(), "src/home/home-sync-status.ts"), "utf8");
    const body = moduleSource.slice(moduleSource.indexOf("export function resolveHomeSyncStatus"));
    expect(body).not.toContain('"offline"');
  });

  it("화면은 이미 구독 중인 큐 스냅숏만 읽는다(새 훅·새 요청 없음)", () => {
    // 라운드 61 M-1로 인자가 셋이 됐다 — 전부 **같은 스냅숏 한 개**의 필드다(새 훅 없음).
    expect(homeSource).toContain("const homeSyncStatus = resolveHomeSyncStatus(");
    expect(homeSource).toContain("offlineSyncSnapshot.counts,");
    expect(homeSource).toContain("offlineSyncSnapshot.itemStatusRows,");
    expect(homeSource).toContain("offlineSyncSnapshot.storage");
    expect(homeSource).toContain('status={homeSyncStatus}');
  });
});

/**
 * 라운드 61 M-1 — **0건과 "모름"은 다르다.**
 *
 * 저장소를 열지 못한 부팅에서는 스냅숏이 빈 초기값 + `storage: "unavailable"`이다
 * (src/offline/sync-controller.ts). 그 0을 그대로 읽으면 홈이 "모든 기록이 동기화됐어요."라고
 * 단언하는데, 그 순간 앱이 아는 것은 0건이 아니라 모름이다(DNC: 허위 데이터 표시 금지).
 */
describe("저장소를 열지 못하면 완료를 단언하지 않는다", () => {
  it("빈 스냅숏 + unavailable은 synced가 아니라 unknown이다", () => {
    expect(resolveHomeSyncStatus(counts(), [], "unavailable")).toBe("unknown");
    expect(resolveHomeSyncStatus(null, null, "unavailable")).toBe("unknown");
  });

  it("읽지 못한 숫자로는 어떤 판정도 하지 않는다 — 대기·충돌보다도 앞선다", () => {
    expect(resolveHomeSyncStatus(counts({ conflict: 1, syncing: 1, pending: 1, failed: 1 }), [{ syncState: "pending" }], "unavailable")).toBe(
      "unknown"
    );
  });

  it("storage가 ok이거나 생략되면 종전 판정 그대로다(후방 호환)", () => {
    expect(resolveHomeSyncStatus(counts(), [], "ok")).toBe("synced");
    expect(resolveHomeSyncStatus(counts({ pending: 1 }), [], "ok")).toBe("pending");
    expect(resolveHomeSyncStatus(counts({ conflict: 1 }), [], "ok")).toBe("conflict");
    // 인자를 아예 넘기지 않는 옛 호출부는 한 글자도 달라지지 않는다.
    expect(resolveHomeSyncStatus(counts())).toBe("synced");
  });

  it("라벨은 새 단정을 만들지 않고 저장소 고지의 문장을 그대로 쓴다", () => {
    // 완료를 말하지도, 건수를 말하지도 않는다 -- 저장소를 못 열었으므로 0건도 주장할 수 없다.
    expect(OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE).not.toContain("동기화됐어요");
    expect(OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE).not.toMatch(/\d/);
    // 그 문장은 긴 고지(동기화 상태 화면이 띄우는 줄)의 부분집합이라, 두 화면의 어휘가
    // 구조적으로 갈라질 수 없다.
    expect(OFFLINE_STORAGE_UNAVAILABLE_NOTICE).toContain(OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE);
  });

  it("SyncStatusBar가 그 문장을 그대로 쓰고, 톤은 'offline' 선례와 같은 경고다", () => {
    const asyncState = readFileSync(join(process.cwd(), "src/design-system/patterns/AsyncState.tsx"), "utf8");
    // 인라인 문자열이 아니라 messages.ts의 단일 소스를 import해 쓴다(어휘가 갈라지지 않게).
    expect(asyncState).toContain('import { OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE } from "../../offline/messages";');
    expect(asyncState).toContain(
      '  unknown: { label: OFFLINE_STORAGE_UNKNOWN_PENDING_SENTENCE, icon: "cloud-question", tone: "warning" }'
    );
    // 오류로 단정하지 않는다 -- danger는 사용자가 지금 할 일이 있을 때의 톤이다.
    expect(asyncState).toContain('| "unknown"');
  });
});

/**
 * `SyncStatusCounts`는 지출 행만 센다(src/offline/sync-controller.ts). 준비템 상태 변경은 별도
 * 아웃박스에 쌓이는데, 홈의 이 한 줄은 "모든 기록이 동기화됐어요"라고 앱 전체를 대신해 말한다.
 * 지출 큐만 보고 완료를 단언하면 준비템 탭이 아직 서버 반영을 기다리는 동안 홈이 거짓말을 한다.
 */
describe("준비템 상태 아웃박스도 같은 한 줄이 대변한다", () => {
  it("지출 큐가 비어도 준비템 대기 행이 있으면 완료라고 말하지 않는다", () => {
    expect(resolveHomeSyncStatus(counts(), [{ syncState: "pending" }])).toBe("pending");
  });

  it("준비템 실패 행도 '아직 반영되지 않았다'는 같은 사실이다", () => {
    expect(resolveHomeSyncStatus(counts(), [{ syncState: "failed" }])).toBe("pending");
  });

  it("준비템이 전송 중이면 전송 중으로 올라간다", () => {
    expect(resolveHomeSyncStatus(counts(), [{ syncState: "syncing" }])).toBe("syncing");
    // 대기와 전송 중이 섞이면 전송 중이 먼저다(지출 큐와 같은 우선순위).
    expect(resolveHomeSyncStatus(counts(), [{ syncState: "pending" }, { syncState: "syncing" }])).toBe("syncing");
  });

  it("지출 충돌은 여전히 가장 먼저다(사용자가 확인해야 하는 쪽)", () => {
    expect(resolveHomeSyncStatus(counts({ conflict: 1 }), [{ syncState: "syncing" }])).toBe("conflict");
  });

  it("준비템 큐가 비었거나 없으면 지출 큐 판정 그대로다", () => {
    expect(resolveHomeSyncStatus(counts(), [])).toBe("synced");
    expect(resolveHomeSyncStatus(counts(), null)).toBe("synced");
    expect(resolveHomeSyncStatus(counts())).toBe("synced");
    expect(resolveHomeSyncStatus(counts({ pending: 1 }), [])).toBe("pending");
  });

  it("지출 스냅숏이 아직 없어도 준비템 대기 행은 놓치지 않는다", () => {
    expect(resolveHomeSyncStatus(null, [{ syncState: "pending" }])).toBe("pending");
    expect(resolveHomeSyncStatus(null, [])).toBe("synced");
  });
});
