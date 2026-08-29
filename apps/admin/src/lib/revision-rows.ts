import type { ContentRevision, ContentRevisionStatus, WorkerHealth } from "./admin-api";
import { workerHealthState, workerHealthStateNote, type WorkerHealthState } from "./worker-health-view";

// UX-X C6: 검토 목록의 "대상"·"예약" 열. 목록 응답이 이미 싣고 오는 값(payload,
// scheduledFor)만 쓰므로 API 변경도 추가 요청도 없다 — 종전에는 종류/버전/상태/제출일만
// 보여서, 어떤 준비템·링크를 고치는 초안인지 상세를 열어야만 알 수 있었다.

/**
 * payload에서 사람이 읽는 이름을 뽑는 순서.
 * product_link=title, item_template=name, disclosure=key
 * (apps/api/src/admin/content-revisions.service.ts의 게시 경로가 쓰는 필드와 같다).
 */
const TARGET_NAME_KEYS = ["title", "name", "key"] as const;

/** uuid 전체는 표에서 너무 길다 — 앞 8자만 남기고 줄임표. */
export function shortEntityId(entityId: string): string {
  return entityId.length <= 8 ? entityId : `${entityId.slice(0, 8)}…`;
}

/**
 * 대상 열 값. 이름이 payload에 없으면(예: 이름을 바꾸지 않는 부분 수정) entityId 축약으로
 * 폴백하고, 그것도 없으면(신규 생성 초안) "신규".
 */
export function revisionTargetLabel(revision: Pick<ContentRevision, "entityId" | "payload">): string {
  const payload = revision.payload ?? {};
  for (const key of TARGET_NAME_KEYS) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return revision.entityId ? shortEntityId(revision.entityId) : "신규";
}

export type RevisionStatusFilter = ContentRevisionStatus | "all";

/** 검토 화면 상태 필터의 선택지(렌더링 순서 고정). URL 파라미터도 이 목록만 받는다. */
export const REVISION_STATUS_FILTERS: readonly RevisionStatusFilter[] = [
  "in_review",
  "published",
  "rejected",
  "all"
];

export const DEFAULT_REVISION_STATUS_FILTER: RevisionStatusFilter = "in_review";

/**
 * UX-X C5: 대시보드 "검수 대기 콘텐츠" 카드가 /reviews?status=in_review 로 넘어온다.
 * 선택지에 없는 값이나 파라미터 없음은 기본값(검토 대기)으로 떨어뜨린다 — 필터 select가
 * 고를 수 없는 상태로 들어가 빈 목록만 보이는 일이 없게.
 */
export function revisionStatusFilterFromSearchParams(
  params: { get(name: string): string | null } | null | undefined
): RevisionStatusFilter {
  const raw = params?.get("status") ?? null;
  return REVISION_STATUS_FILTERS.find((value) => value === raw) ?? DEFAULT_REVISION_STATUS_FILTER;
}

/*
 * 라운드 73 트랙 D(GAP-073 #4ⓑ·ⓒ) — 예약 게시가 **일어나는 조건**과 **일어나지 않은 사실**.
 *
 * 예약 폼은 종전에도 조건을 적어 두긴 했다("예약 실행은 백그라운드 워커(WORKER_ENABLED=1)가
 * 켜져 있어야 동작해요"). 그런데 그 조건의 답은 이 앱이 이미 부를 수 있다 —
 * `getWorkerHealth()` + `worker-health-view.ts`. 라운드 52 C-07 이후 이 저장소의 규율은
 * "**확인하고 말한다**"인데 이 자리만 "조건을 적어 두고" 말았다.
 *
 * 아래 둘은 순수 함수다(테스트: src/lib/revision-rows.test.ts).
 */

/**
 * 예약 게시가 **실제로 실행되지 않는** 워커 상태 둘.
 *
 * `degraded`(어떤 잡이 연속 실패 중)는 여기 없다 — 실패 중인 잡이 링크 검사일 수 있고,
 * 그때 예약 게시는 정상 실행된다. 확인되지 않은 것을 예약 폼 위에서 단정하지 않는다
 * (그 상태는 대시보드의 백그라운드 작업 한 줄이 이미 말한다).
 */
export const SCHEDULE_BLOCKING_WORKER_STATES: readonly WorkerHealthState[] = ["off", "stale"];

/**
 * 예약 폼 위에 세울 사실 한 줄. **문장은 `workerHealthStateNote()`가 이미 가진 것을 그대로**
 * 읽는다(새 문구 0건). 워커 상태를 아직 모르면(요청 실패·로딩) null — 모르는 것을 말하지 않는다.
 *
 * ⚠️ 이 값은 **예약을 막지 않는다.** 워커는 켜질 수 있고, 켜지면 밀린 예약이 실제로 처리된다
 * (apps/api content-revisions.service.ts). 막는 것이 아니라 말하는 것이 이 자리의 판정이다.
 */
export function schedulingWorkerNote(health: WorkerHealth | null | undefined): string | null {
  if (!health) return null;
  if (!SCHEDULE_BLOCKING_WORKER_STATES.includes(workerHealthState(health))) return null;
  return workerHealthStateNote(health) || null;
}

/**
 * 지난 예약 표시. 예약 시각이 지났는데도 상태가 `in_review`면 **그 게시는 일어나지 않았다**
 * (워커가 꺼졌거나 멈춘 동안 그 시각이 지나갔다). 종전 목록은 지난 날짜를 그냥 적었다.
 *
 * 문장이 "영영 안 나간다"고 말하지 않는 이유: 서버는 다시 켜지면 늦게라도 처리한다.
 * 확실한 사실은 "아직 게시되지 않았다" 하나뿐이고, 그것만 적는다.
 */
export const OVERDUE_SCHEDULE_NOTE = "지난 예약 · 아직 게시되지 않았어요";

export function isOverdueScheduledRevision(
  revision: Pick<ContentRevision, "scheduledFor" | "status">,
  now: number = Date.now()
): boolean {
  if (revision.status !== "in_review") return false;
  if (!revision.scheduledFor) return false;
  const scheduled = new Date(revision.scheduledFor).getTime();
  if (Number.isNaN(scheduled)) return false;
  return scheduled < now;
}

/** 예약 칸에 덧붙는 표시(없으면 null) — 화면은 분기하지 않고 이 값을 그린다. */
export function overdueScheduleNote(
  revision: Pick<ContentRevision, "scheduledFor" | "status">,
  now: number = Date.now()
): string | null {
  return isOverdueScheduledRevision(revision, now) ? OVERDUE_SCHEDULE_NOTE : null;
}
