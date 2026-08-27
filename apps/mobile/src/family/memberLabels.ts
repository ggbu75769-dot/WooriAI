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
