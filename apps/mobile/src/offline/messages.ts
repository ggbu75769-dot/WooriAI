/**
 * User-facing copy for MOB-102 / EXP-005 (round5a-sprint1-plan.md §3.3, §3.4). Centralized so
 * every screen that touches offline save/sync/conflict state renders the exact same wording the
 * design doc specifies, and so tests can assert on the copy without duplicating literals.
 */

/** Shown immediately after a local (SQLite-first) save, before the server has confirmed it. */
export const OFFLINE_SAVED_MESSAGE = "기기에 저장했어요. 연결되면 자동으로 반영할게요.";

/** Shown only once the server has actually accepted the write -- never shown pre-emptively. */
export const SERVER_CONFIRMED_MESSAGE = "기록했어요. 이번 달 우리 아이 비용에 더해둘게요.";

/** Conflict banner headline (D-10 default). */
export const CONFLICT_BANNER_MESSAGE = "다른 기기에서 이 기록이 바뀌었어요.";

export const CONFLICT_OPTION_ADOPT_SERVER_LABEL = "다른 기기 값 유지";
export const CONFLICT_OPTION_REAPPLY_MINE_LABEL = "내 변경 다시 적용";
export const CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL = "두 값 나란히 보기";

/**
 * REC-123(H4) 동기화 상태 문구 단일 소스.
 *
 * 이 네 상태를 그리는 화면은 둘이다 — 기록 탭(app/(tabs)/records.tsx)의 배지·행 부제와, 그
 * 배지를 눌러 들어가는 동기화 상태 화면(app/sync-status.tsx). 두 화면이 각자 문자열을 인라인
 * 하는 동안 아래 상수들은 아무도 import하지 않았고, 그 사이 같은 상태의 표기가 셋으로 갈렸다:
 * 배지는 "대기", 기록 탭 행 부제는 "동기화 대기", 이 파일의 상수는 "충돌 발생". 한 흐름 안에서
 * 세 표기가 섞이면 사용자는 같은 상태를 서로 다른 것으로 읽는다(DNC-018 톤 일관성).
 *
 * 새 문구를 만들지 않고 **두 화면 중 더 명확한 쪽**으로 확정했다:
 * - 카운트가 붙는 배지/스크린리더 라벨: 두 화면이 이미 함께 쓰던 짧은 라벨("대기 3"). 숫자가
 *   바로 뒤에 붙는 자리라 "동기화 대기 3"보다 짧은 쪽이 읽기 쉽다.
 * - 기록 탭 행 부제: 기록 탭 쪽 긴 문구("동기화 대기", "동기화 실패 · 확인 필요"). 일반 지출
 *   행들 사이에 섞여 있어서 무엇에 대한 대기·실패인지 문장이 스스로 말해야 한다.
 */
export type SyncStatusKind = "pending" | "syncing" | "failed" | "conflict";

/** 카운트 배지·스크린리더 라벨에 쓰는 짧은 상태 이름. */
export const SYNC_STATUS_PENDING_LABEL = "대기";
export const SYNC_STATUS_SYNCING_LABEL = "동기화 중";
export const SYNC_STATUS_FAILED_LABEL = "실패";
export const SYNC_STATUS_CONFLICT_LABEL = "충돌";

const SYNC_STATUS_LABELS: Record<SyncStatusKind, string> = {
  pending: SYNC_STATUS_PENDING_LABEL,
  syncing: SYNC_STATUS_SYNCING_LABEL,
  failed: SYNC_STATUS_FAILED_LABEL,
  conflict: SYNC_STATUS_CONFLICT_LABEL
};

/** 화면에 보이는 배지 문구 — "대기 3". */
export function syncStatusBadgeLabel(kind: SyncStatusKind, count: number): string {
  return `${SYNC_STATUS_LABELS[kind]} ${count}`;
}

/**
 * 스크린리더가 읽는 카운트 문구 — "대기 3건". 배지에는 단위 없이 숫자만 보이지만(공간 문제)
 * TalkBack에서는 "대기 3"이 무엇의 3인지 모호해 단위를 붙인다(A11Y-115).
 */
export function syncStatusCountLabel(kind: SyncStatusKind, count: number): string {
  return `${SYNC_STATUS_LABELS[kind]} ${count}건`;
}

/**
 * 기록 탭 목록에서 아직 서버에 반영되지 않은 행의 부제. 대기 행만 날짜가 뒤에 붙으므로
 * (`동기화 대기 · 8월 5일`) 상수는 접두 부분까지만 담는다.
 */
export const SYNC_ROW_PENDING_DELETE_LABEL = "삭제 대기 중";
export const SYNC_ROW_CONFLICT_LABEL = "다른 기기와 충돌 · 확인 필요";
export const SYNC_ROW_FAILED_LABEL = "동기화 실패 · 확인 필요";
export const SYNC_ROW_PENDING_LABEL = "동기화 대기";

export const SYNC_STATUS_RETRY_LABEL = "재시도";
export const SYNC_STATUS_DISCARD_LABEL = "삭제";
