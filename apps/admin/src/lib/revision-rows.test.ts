import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVISION_STATUS_FILTER,
  OVERDUE_SCHEDULE_NOTE,
  REVISION_STATUS_FILTERS,
  SCHEDULE_BLOCKING_WORKER_STATES,
  isOverdueScheduledRevision,
  overdueScheduleNote,
  revisionStatusFilterFromSearchParams,
  revisionTargetLabel,
  schedulingWorkerNote,
  shortEntityId
} from "./revision-rows";
import { workerHealthStateNote } from "./worker-health-view";
import type { WorkerHealth } from "./admin-api";

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
