/**
 * User-facing copy for MOB-102 / EXP-005 (round5a-sprint1-plan.md §3.3, §3.4). Centralized so
 * every screen that touches offline save/sync/conflict state renders the exact same wording the
 * design doc specifies, and so tests can assert on the copy without duplicating literals.
 */

/** Shown immediately after a local (SQLite-first) save, before the server has confirmed it. */
export const OFFLINE_SAVED_MESSAGE = "기기에 저장했어요. 연결되면 자동으로 반영할게요.";

/** Shown only once the server has actually accepted the write -- never shown pre-emptively. */
export const SERVER_CONFIRMED_MESSAGE = "기록 변경을 서버에 반영했어요.";

/** Conflict banner headline (D-10 default). */
export const CONFLICT_BANNER_MESSAGE = "다른 기기에서 이 기록이 바뀌었어요.";

export const CONFLICT_OPTION_ADOPT_SERVER_LABEL = "다른 기기 값 유지";
export const CONFLICT_OPTION_REAPPLY_MINE_LABEL = "내 변경 다시 적용";
export const CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL = "두 값 나란히 보기";

export const SYNC_STATUS_PENDING_LABEL = "동기화 대기";
export const SYNC_STATUS_SYNCING_LABEL = "동기화 중";
export const SYNC_STATUS_FAILED_LABEL = "동기화 실패";
export const SYNC_STATUS_CONFLICT_LABEL = "충돌 발생";

export const SYNC_STATUS_RETRY_LABEL = "재시도";
export const SYNC_STATUS_DISCARD_LABEL = "삭제";
