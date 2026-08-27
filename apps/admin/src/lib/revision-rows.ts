import type { ContentRevision, ContentRevisionStatus } from "./admin-api";

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
