import type { AdminAuditLogEntry, AdminAuditLogsQuery } from "./admin-api";

/**
 * 라운드 56 트랙 C(CS-101): 감사 로그 화면의 필터 검증/쿼리 조립 + 행위자 표기.
 * DOM·네트워크를 모르는 순수 모듈이라 화면 없이 단위 테스트한다
 * (app/audit-logs/page.tsx는 이 함수들을 배선만 한다).
 *
 * 서버 계약(apps/api/src/admin/dto/audit-logs.dto.ts):
 * - action: 문자열 정확 일치, MaxLength(80)
 * - actorUserId: `@IsUUID()` — UUID가 아니면 400이고, 화면에는 원인을 알 수 없는
 *   "불러오지 못했어요"만 뜬다. 그래서 보내기 전에 여기서 먼저 걸러 안내한다.
 * - from/to: ISO-8601
 */

export type AuditLogFilters = {
  /** 액션 타입 정확 일치. */
  action: string;
  /** 행위자 id(UUID). 어드민 계정 id일 수도, 앱 사용자 id일 수도 있다. */
  actorUserId: string;
  /** yyyy-MM-dd (date input). API로는 하루 시작/끝 ISO 타임스탬프로 변환해 보낸다. */
  fromDate: string;
  toDate: string;
};

/** 서버 DTO의 `@MaxLength(80)`과 같은 값 — 입력칸 maxLength로도 쓴다. */
export const AUDIT_LOG_ACTION_MAX_LENGTH = 80;

/** audit_logs.actor_user_id는 UUID만 저장된다(AuditLoggerService.asUuidOrNull과 동일 패턴). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function emptyAuditLogFilters(): AuditLogFilters {
  return { action: "", actorUserId: "", fromDate: "", toDate: "" };
}

export function isAuditLogActorId(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

/**
 * yyyy-MM-dd이면서 **실재하는 날짜**여야 한다. `new Date("2026-02-30T00:00:00")`은
 * NaN이 아니라 3월 2일로 굴러가므로(존재하지 않는 날짜가 조용히 다른 날 경계가 된다)
 * 파싱 결과가 입력과 같은 날인지까지 확인한다.
 */
function isValidDateInput(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const [year, month, day] = value.split("-").map(Number);
  return parsed.getFullYear() === year && parsed.getMonth() + 1 === month && parsed.getDate() === day;
}

/**
 * 조회를 보내기 전 검증. 문제가 없으면 null, 있으면 사용자에게 보여줄 한 줄.
 * (서버가 어차피 400을 주는 값은 여기서 막아 "왜 안 되는지"를 알려 준다.)
 */
export function auditLogFilterError(filters: AuditLogFilters): string | null {
  if (filters.action.trim().length > AUDIT_LOG_ACTION_MAX_LENGTH) {
    return `액션 타입은 ${AUDIT_LOG_ACTION_MAX_LENGTH}자까지 입력할 수 있어요.`;
  }
  const actorUserId = filters.actorUserId.trim();
  if (actorUserId && !isAuditLogActorId(actorUserId)) {
    return "행위자 ID는 UUID 형식이어야 해요. 사용자 조회 화면의 '이 사용자 감사 로그 보기'로 들어오면 자동으로 채워져요.";
  }
  if (filters.fromDate && !isValidDateInput(filters.fromDate)) {
    return "시작일 형식을 확인해 주세요 (YYYY-MM-DD).";
  }
  if (filters.toDate && !isValidDateInput(filters.toDate)) {
    return "종료일 형식을 확인해 주세요 (YYYY-MM-DD).";
  }
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
    return "시작일이 종료일보다 늦어요. 기간을 다시 확인해 주세요.";
  }
  return null;
}

/**
 * 적용된 필터 → 목록/CSV 내보내기 공용 쿼리 파라미터 (limit/offset 제외).
 * 날짜는 **화면을 보는 사람의 로컬 하루**(00:00:00 ~ 23:59:59.999)를 ISO로 변환한다 —
 * "8월 3일 기록"을 찾는 사람이 기대하는 경계다. 검증을 통과하지 못하는 값은
 * 아예 싣지 않는다(잘못된 필터로 조용히 0건이 뜨는 것보다 필터 없음이 낫다 —
 * 호출부는 auditLogFilterError로 먼저 막는다).
 */
export function auditLogFiltersToQuery(
  filters: AuditLogFilters
): Omit<AdminAuditLogsQuery, "limit" | "offset"> {
  const action = filters.action.trim();
  const actorUserId = filters.actorUserId.trim();
  return {
    ...(action ? { action } : {}),
    ...(actorUserId && isAuditLogActorId(actorUserId) ? { actorUserId } : {}),
    ...(isValidDateInput(filters.fromDate)
      ? { from: new Date(`${filters.fromDate}T00:00:00`).toISOString() }
      : {}),
    ...(isValidDateInput(filters.toDate)
      ? { to: new Date(`${filters.toDate}T23:59:59.999`).toISOString() }
      : {})
  };
}

export function hasAnyAuditLogFilter(filters: AuditLogFilters): boolean {
  return Boolean(
    filters.action.trim() || filters.actorUserId.trim() || filters.fromDate || filters.toDate
  );
}

/**
 * URL 초기값 읽기 — /audit-logs?actorUserId=...&action=... (사용자 조회 화면의
 * "이 사용자 감사 로그 보기" 링크가 만드는 주소). 형식에 맞지 않는 값은 버린다:
 * 화면이 열리자마자 400으로 실패하는 대신 필터 없이 열리게 한다.
 */
export function auditLogFiltersFromSearchParams(
  params: { get(name: string): string | null } | null | undefined
): AuditLogFilters {
  const filters = emptyAuditLogFilters();
  const actorUserId = params?.get("actorUserId")?.trim() ?? "";
  if (actorUserId && isAuditLogActorId(actorUserId)) filters.actorUserId = actorUserId;
  const action = params?.get("action")?.trim() ?? "";
  if (action && action.length <= AUDIT_LOG_ACTION_MAX_LENGTH) filters.action = action;
  return filters;
}

/** 사용자 조회 → 감사 로그로 넘어가는 링크 주소. */
export function auditLogsHrefForActor(actorUserId: string): string {
  return `/audit-logs?actorUserId=${encodeURIComponent(actorUserId.trim())}`;
}

export type AuditLogActionPreset = {
  /** 서버에 그대로 보내는 action 문자열. */
  action: string;
  /** datalist에 함께 보여줄 한국어 설명. */
  label: string;
};

/**
 * CS 문의에서 자주 찾는 액션 프리셋(datalist 후보). 값은 전부 API가 실제로
 * 기록하는 문자열이다 — 근거:
 * - expense.update / expense.delete: apps/api/src/finance/expenses.controller.ts
 * - child_profile.delete: apps/api/src/settings/settings.controller.ts
 * - household.member.remove / household.invite.cancel: apps/api/src/households/households.controller.ts
 * - household.leave / account.delete: apps/api/src/settings/settings.controller.ts (GAP-062 #7 —
 *   본인이 스스로 나가거나 탈퇴한 흐름. "내보내기"(household.member.remove)와 다른 액션이다)
 * - auth.login / auth.logout: apps/api/src/auth/auth.service.ts (카카오는 kakao-auth.service.ts)
 * - admin.*: apps/api/src/admin/* (admin-auth / admin-users / admin-categories /
 *   content-revisions / admin.controller / admin-users-lookup)
 * 목록은 "전부"가 아니라 "자주 쓰는 것"이다 — 다른 액션도 직접 입력하면 조회된다.
 */
export const AUDIT_LOG_ACTION_PRESETS: readonly AuditLogActionPreset[] = [
  { action: "expense.update", label: "지출 수정 (금액·메모 등)" },
  { action: "expense.delete", label: "지출 삭제" },
  { action: "child_profile.delete", label: "아이 프로필 삭제" },
  { action: "household.member.remove", label: "가구 구성원 내보내기" },
  { action: "household.invite.cancel", label: "가구 초대 취소" },
  { action: "household.leave", label: "가구 나가기 (본인)" },
  { action: "account.delete", label: "계정 삭제 (탈퇴)" },
  { action: "auth.login", label: "앱 로그인" },
  { action: "auth.logout", label: "앱 로그아웃" },
  { action: "admin.login", label: "어드민 로그인" },
  { action: "admin.user_lookup.search", label: "어드민 사용자 조회" },
  { action: "admin.admin_user.update", label: "어드민 계정 변경" },
  { action: "admin.category.update", label: "카테고리 변경" },
  { action: "admin.content_revision.approve_publish", label: "콘텐츠 승인·발행" },
  { action: "admin.product_link.update", label: "상품 링크 수정" },
  { action: "admin.item_template.update", label: "준비템 수정" }
];

export type AuditLogActor = Pick<AdminAuditLogEntry, "actorUserId" | "actorEmail">;

/**
 * 행위자 종류. 서버는 actor_user_id가 admin_users에 있을 때만 이메일을 붙인다
 * (audit-logs.service.ts) — 그래서 "id는 있는데 이메일이 없다"는 곧
 * **어드민 계정이 아닌 행위자**(앱 사용자, 또는 이미 삭제된 어드민 계정)라는 뜻이다.
 */
export type AuditLogActorKind = "admin" | "non_admin" | "system";

export function auditLogActorKind(entry: AuditLogActor): AuditLogActorKind {
  if (entry.actorEmail) return "admin";
  if (entry.actorUserId) return "non_admin";
  return "system";
}

/** UUID 앞 8자만. 개인정보(이메일·닉네임 등)는 여기에 절대 싣지 않는다. */
export function shortActorId(actorUserId: string): string {
  return actorUserId.slice(0, 8);
}

/**
 * 행위자 표기.
 * - 어드민: 이메일 그대로(원래 동작)
 * - 그 외: `사용자(1a2b3c4d)` — 종전에는 이메일과 UUID 8자가 같은 자리에 섞여 나와서
 *   "관리자 목록에 낯선 값이 있다"처럼 읽혔다. 앞에 종류를 붙여 구분만 하고
 *   개인정보는 더 노출하지 않는다.
 * - 행위자 없음: 시스템/알 수 없음
 */
export function auditLogActorLabel(entry: AuditLogActor): string {
  const kind = auditLogActorKind(entry);
  if (kind === "admin") return entry.actorEmail!;
  if (kind === "non_admin") return `사용자(${shortActorId(entry.actorUserId!)})`;
  return "시스템/알 수 없음";
}
