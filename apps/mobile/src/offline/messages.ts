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

/**
 * SYNC-127 일괄 액션 문구. 개별 행의 "재시도"/"삭제"와 같은 동사를 쓰되 범위를 앞에 붙여
 * ("전체") 한 화면 안에서 두 액션이 서로 다른 것을 가리킨다는 사실이 문구만으로 드러나게 한다.
 * 버리기 쪽만 "삭제"가 아니라 "버리기"인 이유: 개별 삭제는 한 건이라 취소가 쉽지만, 일괄은
 * 되돌릴 수 없는 파괴적 동작이라 확인 Alert를 거친다 -- 문구도 그만큼 무겁게 읽혀야 한다.
 */
export const SYNC_STATUS_RETRY_ALL_LABEL = "전체 재시도";
export const SYNC_STATUS_DISCARD_ALL_LABEL = "전체 버리기";
export const SYNC_STATUS_DISCARD_ALL_CONFIRM_TITLE = "실패한 기록을 모두 버릴까요?";

/** 확인 Alert 본문. 몇 건이 사라지는지 숫자로 못박고, 서버에 없는 기록이라는 사실을 밝힌다. */
export function syncStatusDiscardAllConfirmMessage(count: number): string {
  return `${count}건은 아직 이 기기에만 저장돼 있어요. 버리면 되돌릴 수 없어요.`;
}

/**
 * AUTH-127 — 로그인 화면 안내. 리프레시 토큰이 만료(30일)되거나 재사용 감지로 폐기돼
 * 사용자가 원하지 않은 로그아웃이 일어났을 때만 뜬다(명시적 로그아웃에는 뜨지 않는다).
 * 뒷문장이 오프라인 대기분을 약속하는 이유: AUTH-127이 만료 시 outbox를 보존하기로 했고,
 * 같은 계정으로 다시 로그인하면 실제로 그대로 이어서 전송된다(src/offline/session-expiry.ts).
 * 지키지 못할 약속을 하지 않는다 -- 다른 계정으로 로그인하면 PRIV-104 teardown이 그대로
 * 동작하지만, 그 경우 이 안내를 읽은 사람과 로그인한 사람이 다르다.
 */
export const SESSION_EXPIRED_LOGIN_NOTICE =
  "세션이 만료됐어요. 다시 로그인하면 저장하지 않은 기록도 이어서 반영할게요.";

/**
 * UX-N — 조회 실패 카드 문구 단일 소스.
 *
 * ## 무엇이 문제였나
 *
 * 조회 실패 카드는 원인과 상관없이 늘 "불러오지 못했어요. 잠시 후 다시 시도해 주세요."였다.
 * 지하철·엘리베이터처럼 아예 연결이 없는 자리에서는 이 문장이 사실과 어긋난다: 기다릴 대상이
 * 없고, [다시 시도]를 눌러도 같은 실패로 되돌아온다. 사용자가 읽는 것은 "앱이 고장났다"이고,
 * 실제로는 그냥 오프라인이다.
 *
 * ## 왜 "연결되면 자동으로 불러올게요"라고 하지 않았나
 *
 * 처음 후보 문구는 "지금은 오프라인이에요. 연결되면 자동으로 불러올게요."였다. 확인해 보니 이
 * 앱에서는 그 약속을 지킬 수 없다 — react-query의 `refetchOnReconnect` 기본값(true)은 그대로지만,
 * 그 트리거가 되는 onlineManager 배선은 FIX-118A에서 의도적으로 제거됐다(src/query/app-refetch.ts
 * 헤더 참고: online=false 동안 쿼리가 paused로 묶여 무한 스피너·백지 화면을 만들었다). RN에는
 * window의 online 이벤트도 없으므로 네이티브에서 재연결 재조회는 **한 번도 발화하지 않는다**.
 * 실제로 배선된 자동 갱신은 포그라운드 복귀(focusManager ← AppState "active")뿐이다.
 *
 * 그래서 못 지킬 약속 대신 지금 할 수 있는 행동을 말한다: "연결된 뒤 다시 시도해 주세요".
 * (onlineManager를 다시 배선하게 되면 이 문구를 "연결되면 자동으로"로 되돌릴 수 있다.)
 *
 * ## 버튼은 그대로 둔다
 *
 * 오프라인이라고 [다시 시도]를 숨기지 않는다. 오프라인 판정은 point-in-time 폴 한 번이라
 * (isCurrentlyOnline, web에서는 항상 true) 틀릴 수 있고, 판정이 틀렸을 때 사용자가 되돌릴
 * 유일한 수단이 이 버튼이다. 문구만 정직해지고 구조·동작은 그대로다(DNC-018: 비난·불안 문구 금지 —
 * "연결을 확인하세요" 같은 지시형 대신 상태를 담담히 말한다).
 */
export const LOAD_ERROR_NOTICE = "불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
export const OFFLINE_LOAD_NOTICE = "지금은 오프라인이에요. 연결된 뒤 다시 시도해 주세요.";
export const LOAD_ERROR_RETRY_LABEL = "다시 시도";

export type LoadErrorCopy = { title: string; actionLabel: string };

/**
 * 순수 판정 함수: 연결 상태만 보고 카드 문구·버튼 라벨을 고른다. 화면은 이 결과를
 * EmptyStateCard에 그대로 넘긴다(문자열만 교체, 구조 변경 없음).
 *
 * `isOnline: true`는 "온라인인데 요청이 실패했다"(서버 오류·타임아웃 등)와 "연결 상태를 알 수
 * 없다"(web 폴백)를 함께 덮는 기본값이라, 판정이 어긋나도 기존 문구로 안전하게 떨어진다.
 */
export function resolveLoadErrorCopy({ isOnline }: { isOnline: boolean }): LoadErrorCopy {
  return {
    title: isOnline ? LOAD_ERROR_NOTICE : OFFLINE_LOAD_NOTICE,
    actionLabel: LOAD_ERROR_RETRY_LABEL
  };
}
