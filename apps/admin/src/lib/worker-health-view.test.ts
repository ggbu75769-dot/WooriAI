import { describe, expect, it } from "vitest";
import type { WorkerHealth, WorkerHealthJob } from "./admin-api";
import {
  WORKER_HEALTH_STATE_LABELS,
  brokenLinkCountCaption,
  failingJobNames,
  formatMsAgo,
  formatWorkerLastTick,
  linkHealthCheckLine,
  linkHealthCheckState,
  linkHealthJob,
  workerHealthState,
  workerHealthStateNote
} from "./worker-health-view";

function makeJob(overrides: Partial<WorkerHealthJob> = {}): WorkerHealthJob {
  return {
    name: "link_health",
    lastStatus: "ok",
    lastRunAt: "2026-08-27T00:00:00.000Z",
    lastDurationMs: 12,
    consecutiveFailures: 0,
    lastSummary: { enabled: true, checked: 10, ok: 8, broken: 1, unstable: 1, errors: 0 },
    ...overrides
  };
}

function makeHealth(overrides: Partial<WorkerHealth> = {}): WorkerHealth {
  return {
    enabled: true,
    intervalMs: 60_000,
    lastTickStartedAt: "2026-08-27T00:00:00.000Z",
    lastTickFinishedAt: "2026-08-27T00:00:01.000Z",
    msSinceLastTick: 30_000,
    stale: false,
    degraded: false,
    failureThreshold: 3,
    jobs: [makeJob()],
    ...overrides
  };
}

describe("workerHealthState (UX-X C5)", () => {
  it("reports 꺼짐 first: a disabled worker is not 'ok' even with no failures", () => {
    expect(workerHealthState(makeHealth({ enabled: false }))).toBe("off");
    expect(WORKER_HEALTH_STATE_LABELS.off).toBe("꺼짐");
  });

  it("prefers stale over degraded, and ok only when nothing is wrong", () => {
    expect(workerHealthState(makeHealth({ stale: true, degraded: true }))).toBe("stale");
    expect(workerHealthState(makeHealth({ degraded: true }))).toBe("degraded");
    expect(workerHealthState(makeHealth())).toBe("ok");
  });

  it("names the failing jobs behind a degraded verdict", () => {
    const health = makeHealth({
      degraded: true,
      jobs: [makeJob({ consecutiveFailures: 0 }), makeJob({ name: "data_retention_purge", lastStatus: "failed", consecutiveFailures: 4 })]
    });
    expect(failingJobNames(health)).toEqual(["data_retention_purge"]);
    expect(workerHealthStateNote(health)).toContain("data_retention_purge");
    expect(workerHealthStateNote(health)).toContain("연속 3회");
  });

  it("explains 꺼짐/멈춤 and says nothing extra when healthy", () => {
    expect(workerHealthStateNote(makeHealth({ enabled: false }))).toContain("WORKER_ENABLED=0");
    expect(workerHealthStateNote(makeHealth({ stale: true }))).toContain("실행 기록이 없어요");
    expect(workerHealthStateNote(makeHealth())).toBe("");
  });
});

describe("formatWorkerLastTick", () => {
  it("formats elapsed time in Korean and admits when no tick ever finished", () => {
    expect(formatMsAgo(0)).toBe("방금 전");
    expect(formatMsAgo(5 * 60_000)).toBe("5분 전");
    expect(formatMsAgo(3 * 60 * 60_000)).toBe("3시간 전");
    expect(formatMsAgo(2 * 24 * 60 * 60_000)).toBe("2일 전");
    expect(formatWorkerLastTick(makeHealth({ msSinceLastTick: 120_000 }))).toBe("마지막 실행 2분 전");
    expect(formatWorkerLastTick(makeHealth({ msSinceLastTick: null }))).toBe("실행 기록 없음");
  });
});

describe("link health check state", () => {
  it("is 'on' only when the last recorded run actually ran the check", () => {
    expect(linkHealthCheckState(makeHealth())).toBe("on");
    expect(linkHealthJob(makeHealth())?.name).toBe("link_health");
    expect(linkHealthCheckLine(makeHealth())).toBe("링크 검사: 최근 회차 10건 확인 · 깨짐 1 · 불안정 1");
  });

  it("is 'off' when LINK_HEALTH_ENABLED is not set (summary enabled=false)", () => {
    const health = makeHealth({ jobs: [makeJob({ lastSummary: { enabled: false, checked: 0 } })] });
    expect(linkHealthCheckState(health)).toBe("off");
    expect(linkHealthCheckLine(health)).toContain("꺼짐");
    // 건수를 말하지 않는다 — 검사하지 않은 0을 결과처럼 보여주지 않기 위해서.
    expect(linkHealthCheckLine(health)).not.toContain("0건 확인");
  });

  it("is 'unknown' with no job record, and also when the last run failed (summary is empty)", () => {
    expect(linkHealthCheckState(makeHealth({ jobs: [] }))).toBe("unknown");
    const failed = makeHealth({ jobs: [makeJob({ lastStatus: "failed", consecutiveFailures: 1, lastSummary: {} })] });
    expect(linkHealthCheckState(failed)).toBe("unknown");
    expect(linkHealthCheckLine(failed)).toContain("실행 기록 없음");
  });
});

// 허위 안심 제거: 검사가 돌지 않는 상태의 "깨진 상품 링크 0"은 이상 없음이 아니다.
describe("brokenLinkCountCaption", () => {
  it("spells out that 0 means '확인 안 됨' when the check is not running", () => {
    const off = makeHealth({ jobs: [makeJob({ lastSummary: { enabled: false } })] });
    expect(brokenLinkCountCaption(off, 0)).toBe("링크 검사가 돌지 않아 0건 = 확인 안 됨이에요.");
    expect(brokenLinkCountCaption(makeHealth({ jobs: [] }), 0)).toContain("0건 = 확인 안 됨");
  });

  it("warns that a non-zero count is only as fresh as the last check", () => {
    const off = makeHealth({ enabled: false, jobs: [makeJob({ lastSummary: { enabled: false } })] });
    expect(brokenLinkCountCaption(off, 3)).toContain("마지막 검사 시점 기준");
  });

  it("stays silent when the check is running, or when the worker state is unknown", () => {
    expect(brokenLinkCountCaption(makeHealth(), 0)).toBeNull();
    expect(brokenLinkCountCaption(null, 0)).toBeNull();
  });
});
