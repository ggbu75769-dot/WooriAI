import type { WorkerHealth, WorkerHealthJob } from "./admin-api";

// UX-X C5: 대시보드 "백그라운드 작업" 한 줄이 쓰는 순수 표시 로직.
// GET /health/worker(INF-007, 무인증 공개 — 응답에는 카운트/불리언만 남는다)를
// 운영자가 한눈에 읽는 문구로 옮긴다. 페이지 렌더링과 분리해 두는 이유는
// link-filters.ts와 같다 — 이 판단들(특히 "0건 = 확인 안 됨")을 테스트로 못박기
// 위해서다.

/** 워커 잡 이름 (apps/api/src/worker/jobs/link-health.job.ts). */
export const LINK_HEALTH_JOB_NAME = "link_health";

export type WorkerHealthState = "off" | "stale" | "degraded" | "ok";

export const WORKER_HEALTH_STATE_LABELS: Record<WorkerHealthState, string> = {
  off: "꺼짐",
  stale: "멈춤",
  degraded: "이상",
  ok: "정상"
};

/**
 * 표시 우선순위: 꺼짐 > 멈춤 > 이상 > 정상.
 * `stale`은 서버가 이미 enabled=false일 때 false로 내려주지만, 우선순위를 여기서도
 * 명시해 두면 표시 규칙이 한 곳에서 읽힌다.
 */
export function workerHealthState(health: WorkerHealth): WorkerHealthState {
  if (!health.enabled) return "off";
  if (health.stale) return "stale";
  if (health.degraded) return "degraded";
  return "ok";
}

/** `degraded`를 만든 잡 이름들(연속 실패 임계치 이상). */
export function failingJobNames(health: WorkerHealth): string[] {
  return health.jobs
    .filter((job) => job.consecutiveFailures >= health.failureThreshold)
    .map((job) => job.name);
}

/** 상태 뒤에 붙는 설명. 정상이면 덧붙일 말이 없다(빈 문자열). */
export function workerHealthStateNote(health: WorkerHealth): string {
  switch (workerHealthState(health)) {
    case "off":
      return "워커가 꺼져 있어요(WORKER_ENABLED=0). 예약 게시·링크 검사·정리 작업이 실행되지 않아요.";
    case "stale":
      return "워커가 켜져 있는데 주기의 3배가 지나도록 실행 기록이 없어요.";
    case "degraded": {
      const names = failingJobNames(health);
      return `연속 ${health.failureThreshold}회 이상 실패한 작업이 있어요: ${names.join(", ")}`;
    }
    default:
      return "";
  }
}

/** 밀리초 경과를 "방금 전 / N분 전 / N시간 전 / N일 전"으로. */
export function formatMsAgo(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function formatWorkerLastTick(health: WorkerHealth): string {
  if (health.msSinceLastTick === null) return "실행 기록 없음";
  return `마지막 실행 ${formatMsAgo(health.msSinceLastTick)}`;
}

/**
 * 링크 검사(link_health 잡)가 실제로 돌고 있는지.
 * - "on": 마지막 회차 요약이 enabled=true — 검사가 실제로 수행됐다.
 * - "off": 요약이 enabled=false — LINK_HEALTH_ENABLED가 꺼져 있어 매 틱 즉시 반환한다.
 * - "unknown": 잡 기록 자체가 없거나(워커 미기동/최초 틱 전) 마지막 회차가 실패해
 *   요약이 비어 있다(실패 시 서버는 {}를 기록한다).
 */
export type LinkHealthCheckState = "on" | "off" | "unknown";

export function linkHealthJob(health: WorkerHealth): WorkerHealthJob | null {
  return health.jobs.find((job) => job.name === LINK_HEALTH_JOB_NAME) ?? null;
}

export function linkHealthCheckState(health: WorkerHealth): LinkHealthCheckState {
  const job = linkHealthJob(health);
  if (!job) return "unknown";
  if (job.lastSummary.enabled === true) return "on";
  if (job.lastSummary.enabled === false) return "off";
  return "unknown";
}

function countOf(summary: Record<string, number | boolean>, key: string): number {
  const value = summary[key];
  return typeof value === "number" ? value : 0;
}

/** 링크 검사 한 줄. 꺼져 있거나 기록이 없으면 건수를 말하지 않는다. */
export function linkHealthCheckLine(health: WorkerHealth): string {
  const state = linkHealthCheckState(health);
  if (state === "off") return "링크 검사: 꺼짐(LINK_HEALTH_ENABLED=0) — 검사가 돌지 않아요.";
  if (state === "unknown") return "링크 검사: 실행 기록 없음 — 검사가 돌지 않아요.";
  const summary = linkHealthJob(health)?.lastSummary ?? {};
  return `링크 검사: 최근 회차 ${countOf(summary, "checked")}건 확인 · 깨짐 ${countOf(
    summary,
    "broken"
  )} · 불안정 ${countOf(summary, "unstable")}`;
}

/**
 * 대시보드 "깨진 상품 링크" 카드에 붙는 경고. 링크 검사가 돌지 않는 상태에서
 * 0건을 그대로 보여주면 "이상 없음"으로 읽히는데, 실제로는 **아무도 확인하지 않은
 * 값**이다 — 그 허위 안심을 문구로 제거한다.
 * 워커 상태를 아직 모르면(요청 실패/로딩) 아무 말도 하지 않는다.
 */
export function brokenLinkCountCaption(health: WorkerHealth | null, brokenCount: number): string | null {
  if (!health) return null;
  if (linkHealthCheckState(health) === "on") return null;
  return brokenCount === 0
    ? "링크 검사가 돌지 않아 0건 = 확인 안 됨이에요."
    : "링크 검사가 돌지 않아 마지막 검사 시점 기준이에요.";
}
