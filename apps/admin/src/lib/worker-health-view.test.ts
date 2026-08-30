import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { WorkerHealth, WorkerHealthJob } from "./admin-api";
import {
  LINK_HEALTH_JOB_NAME,
  SCHEDULED_PUBLISH_JOB_NAME,
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

/** 저장소 루트 기준 소스 읽기 — 없는 파일을 조용히 통과시키지 않는다(실재 확인). */
function readRepoSource(relativePath: string): string {
  const filePath = join(process.cwd(), "..", "..", ...relativePath.split("/"));
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

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

/*
 * 라운드 79 트랙 D(GAP-079 #4ⓓ) — 잡 이름이 값으로 있으면 `degraded`("어떤 잡이 실패 중")를
 * 잡 단위로 정확히 물을 수 있다. 그 이름이 서버의 진짜 잡 이름이 아니면 배지는 영원히
 * 침묵하므로(조용한 실패), 두 이름을 서버 소스에 대고 못박는다.
 */
describe("워커 잡 이름 상수 (라운드 79 트랙 D)", () => {
  it("두 잡 이름이 서버 잡의 name과 글자까지 같다 (유령 금지)", () => {
    expect(readRepoSource("apps/api/src/worker/jobs/scheduled-publish.job.ts")).toContain(
      `readonly name = "${SCHEDULED_PUBLISH_JOB_NAME}";`
    );
    expect(readRepoSource("apps/api/src/worker/jobs/link-health.job.ts")).toContain(
      `readonly name = "${LINK_HEALTH_JOB_NAME}";`
    );
    // 둘은 서로 다른 잡이다 — 이 구분이 지난 예약 배지의 부정 단언(링크 검사뿐이면 종전
    // 그대로)이 서는 근거다.
    expect(SCHEDULED_PUBLISH_JOB_NAME).not.toBe(LINK_HEALTH_JOB_NAME);
  });

  it("예약 게시 잡이 임계치에 닿으면 이름으로 불리고, 그 전에는 불리지 않는다", () => {
    const failing = makeHealth({
      degraded: true,
      jobs: [makeJob({ name: SCHEDULED_PUBLISH_JOB_NAME, lastStatus: "failed", consecutiveFailures: 3, lastSummary: {} })]
    });
    expect(failingJobNames(failing)).toEqual([SCHEDULED_PUBLISH_JOB_NAME]);
    // 대시보드 한 줄이 말하는 그 사실 그대로다(라운드 78 B).
    expect(workerHealthStateNote(failing)).toContain(SCHEDULED_PUBLISH_JOB_NAME);

    const belowThreshold = makeHealth({
      jobs: [makeJob({ name: SCHEDULED_PUBLISH_JOB_NAME, lastStatus: "failed", consecutiveFailures: 2, lastSummary: {} })]
    });
    expect(failingJobNames(belowThreshold)).toEqual([]);
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

  // UX-X(R43) M-3: 실패한 회차는 "실행 기록 없음"이 아니다. 서버가 실패 시
  // lastSummary를 {}로 남기는 탓에 종전에는 둘이 같은 문구로 뭉개졌고, degraded
  // 임계치(3회) 전인 1~2회 연속 실패 구간에서 "정상 · 마지막 실행 3분 전 · 실행 기록
  // 없음"이라는 모순된 한 줄이 나왔다.
  it("calls a failed run a failure — with the streak — instead of '실행 기록 없음'", () => {
    const failed = makeHealth({ jobs: [makeJob({ lastStatus: "failed", consecutiveFailures: 2, lastSummary: {} })] });
    expect(linkHealthCheckState(failed)).toBe("failed");

    const line = linkHealthCheckLine(failed);
    expect(line).toContain("마지막 검사가 실패했어요");
    expect(line).toContain("연속 2회");
    expect(line).not.toContain("실행 기록 없음");
    // 실패 회차의 빈 요약을 결과처럼 읽히는 0건으로 보여주지 않는다.
    expect(line).not.toContain("0건 확인");

    // degraded 전이라 상태는 아직 '정상'이다 — 그래도 한 줄은 실패를 말한다.
    expect(workerHealthState(failed)).toBe("ok");
  });

  it("separates '아직 첫 실행 전'(no tick yet) from a genuinely missing job record", () => {
    // 프로세스 재시작 직후: 워커 상태는 메모리라 jobs가 비고 틱도 아직 없다.
    const pending = makeHealth({ jobs: [], lastTickStartedAt: null, lastTickFinishedAt: null, msSinceLastTick: null });
    expect(linkHealthCheckState(pending)).toBe("pending");
    expect(linkHealthCheckLine(pending)).toContain("아직 첫 실행 전");

    // 틱은 끝났는데 link_health 기록이 없다 = 이 잡이 정말 돌지 않는다.
    expect(linkHealthCheckState(makeHealth({ jobs: [] }))).toBe("unknown");
    expect(linkHealthCheckLine(makeHealth({ jobs: [] }))).toContain("실행 기록 없음");
  });

  /**
   * 라운드 44 리뷰 N-3: 꺼진 워커를 "아직 첫 실행 전"이라고 부르면, 곧 결과가 나온다는
   * 약속이 된다 — WORKER_ENABLED=0에서는 틱이 영영 없다. 멈춘(stale) 워커도 마찬가지로
   * 기다림이 아니라 고장이다. 둘 다 "돌지 않는다"로 떨어뜨린다.
   */
  it("N-3: does not call a disabled or stale worker '아직 첫 실행 전'", () => {
    const disabled = makeHealth({
      enabled: false,
      jobs: [],
      lastTickStartedAt: null,
      lastTickFinishedAt: null,
      msSinceLastTick: null
    });
    expect(linkHealthCheckState(disabled)).toBe("unknown");
    expect(linkHealthCheckLine(disabled)).not.toContain("아직 첫 실행 전");
    expect(linkHealthCheckLine(disabled)).toContain("검사가 돌지 않아요");
    // 상태 줄과 설명은 꺼짐이라는 사실을 그대로 말한다.
    expect(workerHealthState(disabled)).toBe("off");
    expect(workerHealthStateNote(disabled)).toContain("WORKER_ENABLED=0");

    const stalled = makeHealth({ stale: true, jobs: [], lastTickFinishedAt: null, msSinceLastTick: null });
    expect(linkHealthCheckState(stalled)).toBe("unknown");
    expect(linkHealthCheckLine(stalled)).not.toContain("아직 첫 실행 전");

    // 켜져 있고 멈추지도 않은 진짜 '첫 틱 전'만 pending으로 남는다.
    expect(linkHealthCheckState(makeHealth({ jobs: [], lastTickFinishedAt: null, msSinceLastTick: null }))).toBe(
      "pending"
    );
  });

  /**
   * 라운드 44 리뷰 N-9: 요약의 `errors`는 판정을 남기지 못한 링크 수다(프로브 예외·DB 쓰기
   * 실패). 종전 한 줄은 후보 수(`checked`)만 읽어서, 전건 실패한 회차도 "10건 확인 · 깨짐 0"
   * 으로 보였다 — 아무것도 확인하지 못한 회차가 전수 정상으로 읽혔다.
   */
  it("N-9: counts the links the round failed to check instead of calling them confirmed", () => {
    const allFailed = makeHealth({
      jobs: [makeJob({ lastSummary: { enabled: true, checked: 10, ok: 0, broken: 0, unstable: 0, errors: 10 } })]
    });
    const line = linkHealthCheckLine(allFailed);
    expect(line).toContain("10건 중 0건 확인");
    expect(line).toContain("10건은 확인하지 못했어요");
    // "10건 확인"이라는 전수 확인 주장은 더 이상 나오지 않는다.
    expect(line).not.toContain("최근 회차 10건 확인");

    const partial = makeHealth({
      jobs: [makeJob({ lastSummary: { enabled: true, checked: 10, ok: 6, broken: 1, unstable: 0, errors: 3 } })]
    });
    expect(linkHealthCheckLine(partial)).toBe(
      "링크 검사: 최근 회차 10건 중 7건 확인 · 깨짐 1 · 불안정 0 · 3건은 확인하지 못했어요"
    );

    // errors가 0이면 한 줄은 예전 그대로다(없는 실패를 말하지 않는다).
    expect(linkHealthCheckLine(makeHealth())).toBe("링크 검사: 최근 회차 10건 확인 · 깨짐 1 · 불안정 1");
    // errors 필드 자체가 없는 옛 요약도 같은 취급이다.
    const noErrorsField = makeHealth({
      jobs: [makeJob({ lastSummary: { enabled: true, checked: 4, ok: 4, broken: 0, unstable: 0 } })]
    });
    expect(linkHealthCheckLine(noErrorsField)).toBe("링크 검사: 최근 회차 4건 확인 · 깨짐 0 · 불안정 0");
  });

  it("ignores a different job's record when deciding the link-check state", () => {
    const other = makeHealth({ jobs: [makeJob({ name: "data_retention_purge", lastStatus: "failed", lastSummary: {} })] });
    expect(linkHealthCheckState(other)).toBe("unknown");
  });
});

// 허위 안심 제거: 검사가 돌지 않는 상태의 "깨진 상품 링크 0"은 이상 없음이 아니다.
describe("brokenLinkCountCaption", () => {
  /** 전수 검사가 끝난 상태(미검사 0) — 캡션이 침묵해야 하는 유일한 경우. */
  const allChecked = { active: 58, unchecked: 0, broken: 0 };

  it("spells out that 0 means '확인 안 됨' when the check is not running", () => {
    const off = makeHealth({ jobs: [makeJob({ lastSummary: { enabled: false } })] });
    expect(brokenLinkCountCaption(off, allChecked)).toBe("링크 검사가 돌지 않아 0건 = 확인 안 됨이에요.");
    expect(brokenLinkCountCaption(makeHealth({ jobs: [] }), allChecked)).toContain("0건 = 확인 안 됨");
  });

  it("warns that a non-zero count is only as fresh as the last check", () => {
    const off = makeHealth({ enabled: false, jobs: [makeJob({ lastSummary: { enabled: false } })] });
    expect(brokenLinkCountCaption(off, { active: 58, unchecked: 0, broken: 3 })).toContain("마지막 검사 시점 기준");
  });

  // UX-X(R43) M-3: 실패·첫 실행 전은 "돌지 않아"와 이유가 다르다.
  it("names the reason the number is unverified (failed run / before the first run)", () => {
    const failed = makeHealth({ jobs: [makeJob({ lastStatus: "failed", consecutiveFailures: 1, lastSummary: {} })] });
    expect(brokenLinkCountCaption(failed, allChecked)).toBe("마지막 링크 검사가 실패해 0건 = 확인 안 됨이에요.");

    const pending = makeHealth({ jobs: [], lastTickFinishedAt: null, msSinceLastTick: null });
    expect(brokenLinkCountCaption(pending, allChecked)).toContain("아직 한 번도 돌지 않아");
  });

  /**
   * UX-X(R43) M-4: 워커의 검사 대상은 `active AND affiliateUrl != null`뿐이라, 제휴 URL이
   * 없는 활성 링크는 검사가 켜져 있어도 영원히 미검사로 남는다(시드 기준 상당수).
   * 종전에는 검사가 켜져 있기만 하면 캡션이 null이라 "깨짐 0"이 전수 검사 결과처럼 보였다.
   */
  it("admits how many active links were never checked, even while the check is running", () => {
    const caption = brokenLinkCountCaption(makeHealth(), { active: 58, unchecked: 34, broken: 0 });
    expect(caption).toContain("활성 링크 58개 중 24개 검사");
    expect(caption).toContain("미검사 34개");
    expect(caption).toContain("아직 검사되지 않았어요");
  });

  /**
   * 라운드 44 리뷰 N-4: 미검사의 원인을 하나로 단정하지 않는다. 종전 괄호는 "제휴 URL이
   * 없는 링크는 검사 대상이 아니에요"였는데, 방금 등록돼 배치 차례를 기다리는 링크도
   * 같은 자리에 섞인다 — 확실한 사실을 앞세우고 괄호는 대표 사유 서술로 둔다.
   */
  it("N-4: states the fact (아직 검사되지 않았어요) instead of asserting one cause", () => {
    const caption = brokenLinkCountCaption(makeHealth(), { active: 58, unchecked: 34, broken: 0 })!;
    expect(caption).toContain("아직 검사되지 않았어요");
    expect(caption).toContain("제휴 URL이 없거나 아직 차례가 오지 않은 링크예요");
    expect(caption).not.toContain("검사 대상이 아니에요");
  });

  /**
   * 라운드 44 리뷰 N-7: 검사가 돌고 있고(on) 깨진 링크도 있고 미검사도 남은, 실제로 가장
   * 흔한 조합. 깨짐이 0이 아니라는 이유로 캡션이 침묵하면 "3건 깨짐"이 전수 검사 결과처럼
   * 읽힌다 — 미검사가 남아 있다는 사실은 그대로 남아야 한다.
   */
  it("N-7: keeps the freshness warning when the check runs with both broken and unchecked links", () => {
    const caption = brokenLinkCountCaption(makeHealth(), { active: 58, unchecked: 34, broken: 3 })!;
    expect(caption).not.toBeNull();
    expect(caption).toContain("활성 링크 58개 중 24개 검사");
    expect(caption).toContain("미검사 34개");
    expect(caption).toContain("아직 검사되지 않았어요");
  });

  it("stays silent when every active link is checked, or when the worker state is unknown", () => {
    expect(brokenLinkCountCaption(makeHealth(), allChecked)).toBeNull();
    expect(brokenLinkCountCaption(makeHealth(), { active: 58, unchecked: 0, broken: 2 })).toBeNull();
    expect(brokenLinkCountCaption(null, { active: 58, unchecked: 34, broken: 0 })).toBeNull();
  });
});
