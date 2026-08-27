// ADM-127: /users-lookup 페이지가 쓰는 순수 로직 — 검색어 검증과 결과 카드에
// 들어갈 표시 문자열. 페이지 렌더 없이 단위 테스트로 고정하기 위해 분리한다.
//
// 이 모듈은 서버가 이미 좁혀 보내 준 필드만 만진다. 화면에 없는 개인정보(전화번호,
// 소셜 고유키, 아이 생년월일, 지출 금액·품목)를 여기서 조립하는 일은 없다 —
// 애초에 응답에 오지 않는다(API의 admin-users-lookup.service.ts select 화이트리스트).

import type {
  AdminLookupAuthProvider,
  AdminLookupChild,
  AdminLookupChildStageMode,
  AdminLookupHousehold,
  AdminLookupMemberRole,
  AdminLookupMemberStatus,
  AdminLookupUser,
  AdminLookupUserStatus
} from "./admin-api";

/** API의 USERS_LOOKUP_MIN_QUERY_LENGTH와 같은 값. 한 글자 검색 = 사실상 명단 열람이라 막는다. */
export const USER_LOOKUP_MIN_QUERY_LENGTH = 2;

/**
 * 서버와 같은 기준으로 "실질 검색어 길이"를 센다: LIKE 와일드카드(`%`, `_`)는
 * 길이에 포함하지 않는다. `%%` 같은 입력이 최소 길이를 통과해 전체 명단을
 * 긁어오는 길을 클라이언트에서도 미리 막아, 서버 400을 왕복하지 않게 한다.
 */
export function effectiveQueryLength(query: string): number {
  return query.trim().replaceAll("%", "").replaceAll("_", "").length;
}

/** 검색 버튼을 눌러도 되는지. 문제가 없으면 null. */
export function userLookupQueryError(query: string): string | null {
  if (!query.trim()) return "이메일이나 닉네임을 입력해 주세요.";
  if (effectiveQueryLength(query) < USER_LOOKUP_MIN_QUERY_LENGTH) {
    return `검색어는 ${USER_LOOKUP_MIN_QUERY_LENGTH}자 이상 입력해 주세요.`;
  }
  return null;
}

export const USER_STATUS_LABELS: Record<AdminLookupUserStatus, string> = {
  active: "활성",
  withdrawn: "탈퇴",
  blocked: "차단"
};

export const AUTH_PROVIDER_LABELS: Record<AdminLookupAuthProvider, string> = {
  kakao: "카카오",
  apple: "애플",
  google: "구글"
};

export const MEMBER_ROLE_LABELS: Record<AdminLookupMemberRole, string> = {
  owner: "소유자",
  co_parent: "공동 양육자",
  viewer: "뷰어",
  gift_participant: "선물 참여자"
};

export const MEMBER_STATUS_LABELS: Record<AdminLookupMemberStatus, string> = {
  pending: "초대 대기",
  active: "활성",
  removed: "내보냄",
  left: "나감"
};

export const CHILD_STAGE_MODE_LABELS: Record<AdminLookupChildStageMode, string> = {
  pregnant: "임신 중",
  born: "출생",
  manual: "직접 선택"
};

/** 카드 제목: 표시 이름이 없으면 이메일, 둘 다 없으면 축약 id. */
export function userDisplayLabel(user: Pick<AdminLookupUser, "id" | "email" | "displayName">): string {
  const name = user.displayName?.trim();
  if (name) return name;
  if (user.email) return user.email;
  return `${user.id.slice(0, 8)}…`;
}

/** 탈퇴 계정은 `status`만으로는 눈에 안 띄어서 별도 뱃지 문구를 만든다. */
export function accountStateLabel(user: Pick<AdminLookupUser, "status" | "deletedAt">): string {
  if (user.deletedAt) return "탈퇴(삭제 처리됨)";
  return USER_STATUS_LABELS[user.status];
}

/** 아이 한 줄: 닉네임 + 단계 모드. 생년월일/출산예정일은 응답에 없고, 화면에도 없다. */
export function childSummary(child: Pick<AdminLookupChild, "nickname" | "stageMode">): string {
  return `${child.nickname} · ${CHILD_STAGE_MODE_LABELS[child.stageMode]}`;
}

export function householdRoleSummary(
  household: Pick<AdminLookupHousehold, "role" | "memberStatus">
): string {
  return `${MEMBER_ROLE_LABELS[household.role]} · ${MEMBER_STATUS_LABELS[household.memberStatus]}`;
}

/** 카드 한 줄 요약 — 가구/아이/지출 건수. 지출은 **건수만**이고 금액은 어디에도 없다. */
export function userActivitySummary(
  user: Pick<AdminLookupUser, "households" | "expenseCount">
): string {
  const childCount = user.households.reduce((total, household) => total + household.children.length, 0);
  return `가구 ${user.households.length}개 · 아이 ${childCount}명 · 지출 ${user.expenseCount}건`;
}

export function formatLookupDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR");
}

/** 마지막 활동은 기존 컬럼 users.last_login_at 하나뿐이라, 없으면 "기록 없음"으로 구분해 보여준다. */
export function lastActivityLabel(user: Pick<AdminLookupUser, "lastLoginAt">): string {
  return user.lastLoginAt ? formatLookupDate(user.lastLoginAt) : "기록 없음";
}
