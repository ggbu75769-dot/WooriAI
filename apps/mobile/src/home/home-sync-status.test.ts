import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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
    expect(homeSource).toContain("const homeSyncStatus = resolveHomeSyncStatus(offlineSyncSnapshot.counts);");
    expect(homeSource).toContain('status={homeSyncStatus}');
  });
});
