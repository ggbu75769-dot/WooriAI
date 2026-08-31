import { MEMBER_ROLES, type MemberRole } from "@wooriai/domain";

/**
 * FAM-121B (E3): Korean labels for the four domain member roles.
 *
 * Before this, the family screen collapsed everything that isn't `owner` into a
 * single "멤버" badge, so a 보기 전용 grandparent and a 공동부모 who can spend from
 * the shared budget looked identical. The keys are the `MEMBER_ROLES` domain enum
 * (packages/domain/src/enums.ts) rather than a local string union, so a new role
 * added there fails typecheck here instead of silently rendering the fallback.
 */
const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: "관리자",
  co_parent: "공동부모",
  viewer: "보기 전용",
  gift_participant: "선물 참여"
};

export type MemberBadgeTone = "neutral" | "success" | "warning";

export function isMemberRole(role: string): role is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(role);
}

/** Falls back to the generic "멤버" for a role the client doesn't know yet (older/newer API). */
export function memberRoleLabel(role: string): string {
  return isMemberRole(role) ? MEMBER_ROLE_LABELS[role] : "멤버";
}

/**
 * Badge for a household member row: the role label, plus an explicit "수락 대기"
 * marker for a `pending` membership so an invited-but-not-yet-joined person is
 * never shown as if they had already joined.
 */
export function memberBadge(role: string, status?: string): { label: string; tone: MemberBadgeTone } {
  const label = memberRoleLabel(role);
  if (status === "pending") {
    return { label: `${label} · 수락 대기`, tone: "neutral" };
  }
  return { label, tone: role === "owner" ? "warning" : "neutral" };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * "8월 30일까지 · 3일 남음" for a pending invite.
 *
 * The remaining-days count is a calendar-day difference (not a 24h division), so
 * an invite expiring tomorrow morning reads "1일 남음" rather than "0일 남음".
 * Returns a plain "만료됨" for an already-lapsed timestamp instead of a negative
 * count — the list should never imply a dead link is still usable.
 *
 * FIX-121C(F9-a): single source for all three invite screens — 가족 관리(FAM-001)
 * 대기 초대 목록, 초대 링크 생성(FAM-002), 초대 수락(FAM-003). FAM-002/003 각각
 * "N월 D일까지 유효해요"를 로컬 복제하고 있었는데, 그 문구는 만료된 초대에도 "유효해요"라고
 * 말하는 허위 표시였다(수락 화면은 실제로 만료된 초대를 열 수 있다). 남은 일수를 함께
 * 보여주는 이 한 문구로 통일하면 만료 링크는 "만료됨"으로 정직하게 읽힌다 — 화면별 옵션 분기를
 * 새로 만들 이유가 없어 인자는 그대로 둔다(과설계 금지).
 */
export function formatInviteExpiry(expiresAt: string, now: Date = new Date()): string {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return expiresAt;

  const dateText = `${expiry.getMonth() + 1}월 ${expiry.getDate()}일까지`;
  if (expiry.getTime() <= now.getTime()) return "만료됨";

  const days = Math.round((startOfDay(expiry) - startOfDay(now)) / (24 * 60 * 60 * 1000));
  if (days <= 0) return `${dateText} · 오늘 만료`;
  return `${dateText} · ${days}일 남음`;
}

/**
 * "8월 27일 오후 3시 20분" — 대기 초대가 **만들어진 시각**.
 *
 * 라운드 86 C: 한 가구에 같은 역할의 대기 초대가 둘 이상 설 수 있고(서버의 초대 생성에는
 * 중복 방지가 없다), TTL이 7일 고정이라 같은 날 만든 두 초대는 역할 라벨도 만료 문구도
 * 글자 하나 다르지 않았다. 되돌릴 수 없는 [취소]의 대상이 화면에서 구별되지 않는 것이다.
 * 구별할 재료는 이미 응답에 실려 온다 — `PendingInvite.createdAt`을 화면이 한 번도 읽지
 * 않았을 뿐이다. 이 함수가 그 한 값을 문자열 하나로 파생해, 행의 한 줄과 취소 확인창 제목과
 * 취소 버튼의 낭독 라벨 **셋이 같은 값**을 읽게 한다(두 문장이 갈릴 자리를 만들지 않는다).
 *
 * 어휘가 "만든"인 이유: `createdAt`이 말하는 것은 **초대 링크가 만들어진 시각**뿐이다.
 * 그것을 실제로 상대에게 보냈는지 서버도 앱도 모르므로 "보냈어요"는 단정이 된다. 초대 화면의
 * 버튼도 [초대 링크 만들기]라 같은 동사를 쓴다.
 *
 * 분 단위까지 적는 이유: 같은 날 한 번 더 만든 초대를 구별하는 것이 이 값의 존재 이유다.
 * 날짜까지만 적으면 실패 시나리오(같은 날 두 번 보낸 초대) 그대로 다시 같은 줄이 된다.
 *
 * `formatInviteExpiry`와 달리 파싱 실패·값 없음에 **null을 돌려준다** — 원문(ISO 문자열)을
 * 그대로 흘리면 사람이 읽을 수 없는 줄이 서고, 없는 시각을 지어내면 허위 표시가 된다.
 * 부르는 쪽은 null이면 그 줄을 그리지 않고 나머지는 종전 그대로 둔다.
 */
export function formatInviteCreatedAt(createdAt: string | null | undefined): string | null {
  if (typeof createdAt !== "string") return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;

  const hour = created.getHours();
  const meridiem = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minute = created.getMinutes();
  const clock = minute === 0 ? `${hour12}시` : `${hour12}시 ${minute}분`;
  return `${created.getMonth() + 1}월 ${created.getDate()}일 ${meridiem} ${clock}`;
}
