import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVISION_STATUS_FILTER,
  OVERDUE_SCHEDULE_JOB_FAILING_NOTE,
  OVERDUE_SCHEDULE_NOTE,
  REVISION_STATUS_FILTERS,
  SCHEDULE_BLOCKING_WORKER_STATES,
  isOverdueScheduledRevision,
  overdueScheduleBadge,
  overdueScheduleNote,
  revisionStatusFilterFromSearchParams,
  revisionTargetLabel,
  schedulingWorkerNote,
  shortEntityId
} from "./revision-rows";
import {
  LINK_HEALTH_JOB_NAME,
  SCHEDULED_PUBLISH_JOB_NAME,
  workerHealthState,
  workerHealthStateNote
} from "./worker-health-view";
import type { WorkerHealth, WorkerHealthJob } from "./admin-api";

/** 어드민 소스 읽기 — 없는 파일을 조용히 통과시키지 않는다(실재 확인). */
function readAdminSource(relativePath: string): string {
  const filePath = join(process.cwd(), ...relativePath.split("/"));
  expect(existsSync(filePath), `apps/admin/${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

describe("revisionTargetLabel (UX-X C6)", () => {
  it("uses the payload name a human recognises, per entity type", () => {
    expect(revisionTargetLabel({ entityId: "abc", payload: { title: "쿠팡 속싸개 3종" } })).toBe("쿠팡 속싸개 3종");
    expect(revisionTargetLabel({ entityId: "abc", payload: { name: "젖병 소독기" } })).toBe("젖병 소독기");
    expect(revisionTargetLabel({ entityId: "abc", payload: { key: "affiliate_purchase" } })).toBe("affiliate_purchase");
  });

  it("prefers title over name/key and trims surrounding whitespace", () => {
    expect(revisionTargetLabel({ entityId: null, payload: { title: "  링크 제목  ", name: "준비템" } })).toBe("링크 제목");
  });

  it("falls back to a shortened entityId, then to 신규 for a create draft", () => {
    expect(revisionTargetLabel({ entityId: "0a1b2c3d-4e5f-6789-abcd-ef0123456789", payload: { active: false } })).toBe(
      "0a1b2c3d…"
    );
    expect(revisionTargetLabel({ entityId: null, payload: { active: false } })).toBe("신규");
    // 빈 문자열/공백뿐인 이름은 이름이 아니다.
    expect(revisionTargetLabel({ entityId: null, payload: { title: "   " } })).toBe("신규");
  });

  it("leaves already-short ids alone", () => {
    expect(shortEntityId("abc")).toBe("abc");
    expect(shortEntityId("12345678")).toBe("12345678");
  });
});

describe("revisionStatusFilterFromSearchParams (UX-X C5)", () => {
  it("reads the dashboard card's ?status=in_review", () => {
    expect(revisionStatusFilterFromSearchParams(new URLSearchParams("status=in_review"))).toBe("in_review");
    expect(revisionStatusFilterFromSearchParams(new URLSearchParams("status=all"))).toBe("all");
  });

  it("falls back to the default for a missing, unknown, or non-selectable status", () => {
    expect(revisionStatusFilterFromSearchParams(new URLSearchParams(""))).toBe(DEFAULT_REVISION_STATUS_FILTER);
    expect(revisionStatusFilterFromSearchParams(null)).toBe(DEFAULT_REVISION_STATUS_FILTER);
    expect(revisionStatusFilterFromSearchParams(new URLSearchParams("status=nonsense"))).toBe("in_review");
    // select에 없는 상태(초안/게시 처리 중/보관됨)로는 들어가지 않는다.
    expect(revisionStatusFilterFromSearchParams(new URLSearchParams("status=draft"))).toBe("in_review");
    expect(REVISION_STATUS_FILTERS).not.toContain("draft");
  });
});

// 라운드 73 트랙 D(GAP-073 #4ⓑ) — 예약 게시의 조건을 확인해서 말한다.
function workerHealth(overrides: Partial<WorkerHealth> = {}): WorkerHealth {
  return {
    enabled: true,
    intervalMs: 60_000,
    lastTickStartedAt: "2026-08-29T00:00:00.000Z",
    lastTickFinishedAt: "2026-08-29T00:00:01.000Z",
    msSinceLastTick: 1_000,
    stale: false,
    degraded: false,
    failureThreshold: 3,
    jobs: [],
    ...overrides
  };
}

describe("schedulingWorkerNote (라운드 73 트랙 D)", () => {
  it("말하는 상태는 꺼짐·멈춤 둘뿐이다", () => {
    expect([...SCHEDULE_BLOCKING_WORKER_STATES]).toEqual(["off", "stale"]);
  });

  it("워커가 꺼져 있으면 workerHealthStateNote()의 문장을 그대로 돌려준다 (새 문구 0건)", () => {
    const off = workerHealth({ enabled: false });
    expect(schedulingWorkerNote(off)).toBe(workerHealthStateNote(off));
    expect(schedulingWorkerNote(off)).toContain("WORKER_ENABLED=0");
  });

  it("워커가 멈춰 있어도 같은 단일 소스에서 문장이 온다", () => {
    const stale = workerHealth({ stale: true });
    expect(schedulingWorkerNote(stale)).toBe(workerHealthStateNote(stale));
  });

  it("정상이면 아무 말도 하지 않는다", () => {
    expect(schedulingWorkerNote(workerHealth())).toBeNull();
  });

  it("degraded는 이 자리에서 말하지 않는다 — 실패 중인 잡이 예약 게시와 무관할 수 있다", () => {
    const degraded = workerHealth({
      degraded: true,
      jobs: [
        {
          name: "link_health",
          lastStatus: "failed",
          lastRunAt: "2026-08-29T00:00:00.000Z",
          lastDurationMs: 10,
          consecutiveFailures: 5,
          lastSummary: {}
        }
      ]
    });
    // 대시보드는 이 상태를 말한다(문장이 존재한다) — 예약 폼 위에서만 말하지 않는다.
    expect(workerHealthStateNote(degraded)).not.toBe("");
    expect(schedulingWorkerNote(degraded)).toBeNull();
  });

  it("워커 상태를 모르면(조회 실패·로딩) 아무 말도 하지 않는다", () => {
    expect(schedulingWorkerNote(null)).toBeNull();
    expect(schedulingWorkerNote(undefined)).toBeNull();
  });
});

// 라운드 73 트랙 D(GAP-073 #4ⓒ) — 지난 예약은 "일어나지 않은 게시"다.
describe("overdueScheduleNote (라운드 73 트랙 D)", () => {
  const now = Date.parse("2026-08-29T12:00:00.000Z");
  const past = "2026-08-24T00:00:00.000Z";
  const future = "2026-09-02T00:00:00.000Z";

  it("예약 시각이 지났는데 아직 검토 대기면 사실을 표시한다", () => {
    expect(isOverdueScheduledRevision({ scheduledFor: past, status: "in_review" }, now)).toBe(true);
    expect(overdueScheduleNote({ scheduledFor: past, status: "in_review" }, now)).toBe(OVERDUE_SCHEDULE_NOTE);
  });

  it("아직 오지 않은 예약에는 표시가 없다", () => {
    expect(overdueScheduleNote({ scheduledFor: future, status: "in_review" }, now)).toBeNull();
  });

  it("이미 게시·반려된 리비전의 지난 예약은 실패가 아니다", () => {
    for (const status of ["published", "rejected", "publishing", "archived", "draft"] as const) {
      expect(overdueScheduleNote({ scheduledFor: past, status }, now), status).toBeNull();
    }
  });

  it("예약이 없거나 값이 시각이 아니면 아무 표시도 하지 않는다", () => {
    expect(overdueScheduleNote({ scheduledFor: null, status: "in_review" }, now)).toBeNull();
    expect(overdueScheduleNote({ scheduledFor: "그런 시각 없음", status: "in_review" }, now)).toBeNull();
  });

  it("문장이 '영영 안 나간다'고 말하지 않는다 — 서버는 다시 켜지면 늦게라도 처리한다", () => {
    expect(OVERDUE_SCHEDULE_NOTE).toContain("아직");
    expect(OVERDUE_SCHEDULE_NOTE).not.toContain("취소");
    expect(OVERDUE_SCHEDULE_NOTE).not.toContain("실패");
  });
});

/*
 * 라운드 79 트랙 D(GAP-079 #4) — 지난 예약 배지가 워커의 실패를 읽는다.
 *
 * 라운드 78 B 전에는 "시도했는데 실패했다"가 **관측 불가능**했다(잡이 예외를 삼켰다). 이제
 * 스케줄러가 `cms_scheduled_publish`의 연속 실패를 기록하고 대시보드가 그것을 말한다.
 * 운영자가 실제로 일하는 화면(/reviews)의 배지만 여전히 한 줄이었고, 그 한 줄은
 * "워커를 켜면 된다"로 읽혔다 — 두 화면이 같은 사실에 대해 서로 다른 다음 행동을 시켰다.
 */
function failingJob(name: string, consecutiveFailures = 3): WorkerHealthJob {
  return {
    name,
    lastStatus: "failed",
    lastRunAt: "2026-08-29T00:00:00.000Z",
    lastDurationMs: 12,
    consecutiveFailures,
    // 서버는 실패 회차의 요약을 {}로 남긴다(worker-status.service.ts recordJobResult).
    lastSummary: {}
  };
}

describe("overdueScheduleBadge (라운드 79 트랙 D)", () => {
  const now = Date.parse("2026-08-31T09:00:00.000Z");
  const past = "2026-08-29T00:00:00.000Z";
  const future = "2026-09-02T00:00:00.000Z";
  const overdue = { scheduledFor: past, status: "in_review" } as const;
  const scheduledPublishFailing = workerHealth({
    degraded: true,
    jobs: [failingJob(SCHEDULED_PUBLISH_JOB_NAME)]
  });

  it("ⓐ 예약 게시 잡이 실패 중이면 배지가 그 사실을 말한다 (워커 상태에서 파생)", () => {
    expect(overdueScheduleBadge(overdueScheduleNote(overdue, now), scheduledPublishFailing)).toBe(
      OVERDUE_SCHEDULE_JOB_FAILING_NOTE
    );
    // 확실한 사실(아직 게시되지 않았다)은 그대로 두고 뒤에 잇는다 — 버리지 않는다.
    expect(OVERDUE_SCHEDULE_JOB_FAILING_NOTE.startsWith(OVERDUE_SCHEDULE_NOTE)).toBe(true);
    expect(OVERDUE_SCHEDULE_JOB_FAILING_NOTE).toContain("예약 게시 작업이 연속 실패 중이에요");
    // 대시보드가 말하는 그 잡의 실패다 — 같은 잡, 같은 임계치(연속 실패 ≥ failureThreshold).
    expect(workerHealthStateNote(scheduledPublishFailing)).toContain(SCHEDULED_PUBLISH_JOB_NAME);
  });

  it("ⓑ-1 워커 상태를 모르면(조회 실패·로딩) 종전 문장 그대로다", () => {
    expect(overdueScheduleBadge(overdueScheduleNote(overdue, now), null)).toBe(OVERDUE_SCHEDULE_NOTE);
    expect(overdueScheduleBadge(overdueScheduleNote(overdue, now), undefined)).toBe(OVERDUE_SCHEDULE_NOTE);
    // 정상인 워커도 마찬가지다 — 말할 사실이 없다.
    expect(overdueScheduleBadge(overdueScheduleNote(overdue, now), workerHealth())).toBe(OVERDUE_SCHEDULE_NOTE);
  });

  it("ⓑ-2 실패 중인 잡이 링크 검사뿐이면 종전 그대로다 (배지는 잡 이름을 본다)", () => {
    const linkHealthFailing = workerHealth({ degraded: true, jobs: [failingJob(LINK_HEALTH_JOB_NAME)] });
    // 워커는 '이상'이고 대시보드는 그 사실을 말한다 — 그런데 그 실패는 예약 게시와 무관하다.
    expect(workerHealthState(linkHealthFailing)).toBe("degraded");
    expect(workerHealthStateNote(linkHealthFailing)).toContain(LINK_HEALTH_JOB_NAME);
    expect(overdueScheduleBadge(overdueScheduleNote(overdue, now), linkHealthFailing)).toBe(OVERDUE_SCHEDULE_NOTE);
    // 예약 폼 위 안내가 degraded를 뺀 그 판단(SCHEDULE_BLOCKING_WORKER_STATES)도 그대로다.
    expect([...SCHEDULE_BLOCKING_WORKER_STATES]).toEqual(["off", "stale"]);
    expect(schedulingWorkerNote(linkHealthFailing)).toBeNull();
  });

  it("ⓑ-3 지난 예약이 아니면 잡이 실패 중이어도 배지 자체가 없다", () => {
    expect(overdueScheduleBadge(overdueScheduleNote({ scheduledFor: future, status: "in_review" }, now), scheduledPublishFailing)).toBeNull();
    expect(overdueScheduleBadge(overdueScheduleNote({ scheduledFor: past, status: "published" }, now), scheduledPublishFailing)).toBeNull();
    expect(overdueScheduleBadge(overdueScheduleNote({ scheduledFor: null, status: "in_review" }, now), scheduledPublishFailing)).toBeNull();
    expect(overdueScheduleBadge(null, scheduledPublishFailing)).toBeNull();
  });

  it("ⓒ 문장은 **잡**에 대해 말한다 — 이 초안이 실패했다고 단정하지 않는다", () => {
    expect(OVERDUE_SCHEDULE_JOB_FAILING_NOTE).toContain("작업");
    for (const claim of ["이 초안", "이 초안이 실패", "게시에 실패했어요", "취소", "영영"]) {
      expect(OVERDUE_SCHEDULE_JOB_FAILING_NOTE, claim).not.toContain(claim);
    }
    // 재시도를 권하지 않는다(운영자가 눌러서 될 일이 아니다) — 사실 한 줄로 끝난다.
    expect(OVERDUE_SCHEDULE_JOB_FAILING_NOTE).not.toContain("다시 시도");
    // 해요체(DNC-018).
    expect(OVERDUE_SCHEDULE_JOB_FAILING_NOTE.endsWith("이에요")).toBe(true);
  });

  it("임계치 전(1~2회 실패)에는 종전 그대로다 — 대시보드와 같은 임계치를 쓴다", () => {
    for (const failures of [1, 2]) {
      const nearly = workerHealth({ jobs: [failingJob(SCHEDULED_PUBLISH_JOB_NAME, failures)] });
      expect(overdueScheduleBadge(overdueScheduleNote(overdue, now), nearly), `연속 ${failures}회`).toBe(
        OVERDUE_SCHEDULE_NOTE
      );
      // 그 구간은 대시보드도 '이상'이라고 말하지 않는다 — 두 화면이 갈리지 않는다.
      expect(workerHealthState(nearly)).toBe("ok");
    }
  });

  it("워커가 꺼져 있어 기록이 없는 경우도 종전 문장이다 (아직 시도되지 않았다)", () => {
    const off = workerHealth({ enabled: false, jobs: [] });
    expect(overdueScheduleBadge(overdueScheduleNote(overdue, now), off)).toBe(OVERDUE_SCHEDULE_NOTE);
    // 그 사실은 예약 폼 위 안내가 이미 말한다(문장 중복 0건).
    expect(schedulingWorkerNote(off)).toBe(workerHealthStateNote(off));
  });

  it("화면이 이미 손에 든 워커 상태를 그 판정에 넘긴다 (새 요청·새 컨트롤 0건)", () => {
    const page = readAdminSource("app/reviews/page.tsx");
    // 판정은 여전히 순수 함수 한 자리이고, 기준 시각은 행마다 한 번만 읽힌다.
    expect(page).toContain("const overdueNote = overdueScheduleBadge(overdueScheduleNote(revision), worker);");
    // 상태는 종전 그대로 — 예약 폼 안내가 쓰던 그 값이다(새 요청 0건).
    expect(page).toContain("setWorker(await getWorkerHealth())");
    expect(page).toContain("schedulingWorkerNote(worker)");
    // 컨트롤 0건 추가: 배지는 여전히 글자 한 줄이고, 화면의 컨트롤 수는 종전과 같다.
    expect(page).toContain("<span className={`${styles.badge} ${styles.badgeInactive}`}>{overdueNote}</span>");
    expect(page.match(/onClick=/g) ?? []).toHaveLength(7);
    expect(page.match(/ id="/g) ?? []).toHaveLength(3);
    // 문장은 화면이 짓지 않는다 — revision-rows.ts가 가진 것을 그대로 그린다.
    expect(page).not.toContain("예약 게시 작업이");
  });
});
