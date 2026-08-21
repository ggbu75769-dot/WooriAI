/**
 * R20-C 알림함 아이 표시: decides whether a notification row should name the child it is about.
 *
 * Why a module: R19-D started stamping `childId` onto every notification entry
 * (src/notifications/notification.store.ts) but nothing read it, so in a 다자녀 가구 two children
 * produced two visually identical budget rows in the same month (docs/operations/known-limitations.md).
 * The display decision has enough "don't show it" branches (single-child household, pre-R19-D
 * entries with no childId, a childId whose child list hasn't loaded or no longer exists) that it
 * lives here as a pure function with unit tests instead of inline in app/notifications.tsx.
 *
 * Deliberate rule -- the label appears ONLY when the household has 2+ children. With one child
 * every row would carry the same name, which is noise, not information.
 *
 * Never renders an empty prefix: when the name cannot be resolved the row is left exactly as it
 * was before this feature (no "· 제목" stub, no placeholder like "아이"), matching the app's
 * 허위/빈 표시 금지 convention.
 */

/** Structural minimum of `Child` (src/api/client.ts) this module needs. */
export type NotificationChildRef = {
  id: string;
  nickname: string;
};

/** Separator between the child name and the notification title (same convention as the "선물 ·"
 * prefix in app/(tabs)/records.tsx). */
export const NOTIFICATION_CHILD_LABEL_SEPARATOR = " · ";

/**
 * The child name to show on a notification row, or `null` when the row should stay unlabelled.
 *
 * @param childId  entry.childId -- undefined for notifications written before R19-D.
 * @param children the household's children (the `["children"]` query data), or undefined while
 *                 that query is still loading / disabled (logged-out preview).
 */
export function resolveNotificationChildLabel(
  childId: string | undefined,
  children: readonly NotificationChildRef[] | undefined
): string | null {
  // Single child (or unknown child count): naming the child on every row adds no information.
  if (!children || children.length < 2) return null;
  if (!childId) return null;
  const match = children.find((child) => child.id === childId);
  if (!match) return null;
  const nickname = match.nickname.trim();
  return nickname.length > 0 ? nickname : null;
}

/**
 * The row title actually rendered. Keeping the name inside the title (rather than a separate
 * visual badge) is what makes it part of the row's accessibility label too: ListRow has no
 * accessibilityLabel prop, so screen readers announce its Text children, and a prefixed title is
 * therefore read as "다온이 · 이번 달 예산의 80%를 사용했어요".
 */
export function formatNotificationRowTitle(title: string, childLabel: string | null): string {
  return childLabel ? `${childLabel}${NOTIFICATION_CHILD_LABEL_SEPARATOR}${title}` : title;
}
