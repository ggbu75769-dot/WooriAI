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
 * 링크 검사(link_health 잡)의 마지막 회차가 어떻게 끝났는지.
 * - "on": 마지막 회차 요약이 enabled=true — 검사가 실제로 수행됐다.
 * - "off": 요약이 enabled=false — LINK_HEALTH_ENABLED가 꺼져 있어 매 틱 즉시 반환한다.
 * - "failed": 잡 기록은 있는데 마지막 회차가 실패했다.
 * - "pending": 잡 기록이 없고 워커가 아직 한 틱도 끝내지 못했다(프로세스 재시작 직후).
 * - "unknown": 틱은 끝났는데도 link_health 기록이 없다 — 잡이 등록되지 않은 경우.
 *
 * UX-X(R43) M-3: 종전에는 실패한 회차가 "unknown"(= 실행 기록 없음)으로 뭉개졌다.
 * 서버는 실패 시 lastSummary를 {}로 남기므로(worker-status.service.ts recordJobResult)
 * 요약만 보면 기록이 없는 것과 구분되지 않지만, lastStatus·consecutiveFailures·
 * lastRunAt은 남아 있다 — 실패 사실은 알 수 있다. 그래서 요약보다 lastStatus를 먼저
 * 읽는다. degraded 임계치(기본 3회) 전의 1~2회 연속 실패 구간에서 "정상 · 마지막 실행
 * 3분 전 · 실행 기록 없음"이라는 모순된 한 줄이 나오던 원인이 이것이다.
 */
export type LinkHealthCheckState = "on" | "off" | "failed" | "pending" | "unknown";

export function linkHealthJob(health: WorkerHealth): WorkerHealthJob | null {
  return health.jobs.find((job) => job.name === LINK_HEALTH_JOB_NAME) ?? null;
}

export function linkHealthCheckState(health: WorkerHealth): LinkHealthCheckState {
  const job = linkHealthJob(health);
  // 기록이 아예 없는 두 경우를 나눈다: 워커 상태는 프로세스 메모리라(INF-007)
  // 재시작하면 jobs가 비고, 첫 틱이 끝나기 전까지는 "아직 안 돌았다"가 맞다.
  // 틱이 끝났는데도 잡 기록이 없다면 그건 진짜로 이 잡이 돌지 않는다는 뜻이다.
  if (!job) return health.lastTickFinishedAt === null ? "pending" : "unknown";
  if (job.lastStatus === "failed") return "failed";
  if (job.lastSummary.enabled === true) return "on";
  if (job.lastSummary.enabled === false) return "off";
  return "unknown";
}

function countOf(summary: Record<string, number | boolean>, key: string): number {
  const value = summary[key];
  return typeof value === "number" ? value : 0;
}

/**
 * 링크 검사 한 줄. 실제로 수행된 회차가 아니면 건수를 말하지 않는다 —
 * 검사하지 않은 0을 결과처럼 보여주지 않기 위해서다.
 */
export function linkHealthCheckLine(health: WorkerHealth): string {
  const state = linkHealthCheckState(health);
  if (state === "off") return "링크 검사: 꺼짐(LINK_HEALTH_ENABLED=0) — 검사가 돌지 않아요.";
  if (state === "failed") {
    // 실패 회차는 요약이 비어 있으니 건수 대신 실패 사실만 말한다. 연속 횟수를
    // 붙여 두면 degraded(기본 3회) 전에도 악화 중인 게 보인다.
    const failures = linkHealthJob(health)?.consecutiveFailures ?? 1;
    return `링크 검사: 마지막 검사가 실패했어요(연속 ${failures}회) — 이번 회차 결과가 없어요.`;
  }
  if (state === "pending") return "링크 검사: 아직 첫 실행 전이에요 — 첫 회차가 끝나면 결과가 보여요.";
  if (state === "unknown") return "링크 검사: 실행 기록 없음 — 검사가 돌지 않아요.";
  const summary = linkHealthJob(health)?.lastSummary ?? {};
  return `링크 검사: 최근 회차 ${countOf(summary, "checked")}건 확인 · 깨짐 ${countOf(
    summary,
    "broken"
  )} · 불안정 ${countOf(summary, "unstable")}`;
}

/** 검사가 수행되지 않은 각 상태를 "왜 이 숫자를 믿을 수 없는지"로 옮긴다. */
const LINK_CHECK_NOT_RUNNING_REASON: Record<Exclude<LinkHealthCheckState, "on">, string> = {
  off: "링크 검사가 돌지 않아",
  failed: "마지막 링크 검사가 실패해",
  pending: "링크 검사가 아직 한 번도 돌지 않아",
  unknown: "링크 검사가 돌지 않아"
};

/**
 * 대시보드 "깨진 상품 링크" 카드가 쓰는 링크 건수(모두 active=true 기준 —
 * 비활성 링크는 사용자에게 보이지 않으니 깨져도 구매를 막지 않는다).
 */
export type ProductLinkCheckCounts = {
  /** 활성 링크 전체 수. 아래 두 수의 분모. */
  active: number;
  /** 그중 한 번도 검사되지 않은 수(healthStatus=null). */
  unchecked: number;
  /** 그중 깨짐 판정을 받은 수. */
  broken: number;
};

/**
 * 대시보드 "깨진 상품 링크" 카드에 붙는 경고. 0건을 그대로 보여주면 "이상 없음"으로
 * 읽히는데, 실제로는 **아무도 확인하지 않은 값**일 수 있다 — 그 허위 안심을 문구로
 * 제거한다. 워커 상태를 아직 모르면(요청 실패/로딩) 아무 말도 하지 않는다.
 *
 * 두 갈래다.
 *  - 검사가 수행되지 않은 상태(꺼짐·실패·첫 실행 전·기록 없음): 숫자의 출처를 밝힌다.
 *  - 검사가 돌고 있어도(UX-X(R43) M-4) 워커의 검사 대상은 `active AND affiliate_url
 *    IS NOT NULL`뿐이라, 제휴 URL이 없는 활성 링크는 영원히 미검사로 남는다. 종전에는
 *    이 경우 캡션이 통째로 null이라 "깨짐 0"이 전수 검사 결과처럼 보였다. 미검사가
 *    하나라도 있으면 검사된 수와 함께 사실대로 적는다.
 */
export function brokenLinkCountCaption(
  health: WorkerHealth | null,
  counts: ProductLinkCheckCounts
): string | null {
  if (!health) return null;
  const state = linkHealthCheckState(health);
  if (state === "on") {
    if (counts.unchecked <= 0) return null;
    const checked = Math.max(0, counts.active - counts.unchecked);
    return `활성 링크 ${counts.active}개 중 ${checked}개 검사 · 미검사 ${counts.unchecked}개는 확인 안 됨이에요(제휴 URL이 없는 링크는 검사 대상이 아니에요).`;
  }
  const reason = LINK_CHECK_NOT_RUNNING_REASON[state];
  return counts.broken === 0
    ? `${reason} 0건 = 확인 안 됨이에요.`
    : `${reason} 마지막 검사 시점 기준이에요.`;
}
