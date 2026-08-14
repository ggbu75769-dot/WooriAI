/** NOTI-102: warm relative timestamps for the notification list (n분/시간/일 전). Pure and
 * clock-free -- both instants are passed in. A future createdAt (clock skew) clamps to 방금 전. */
export function formatRelativeTime(createdAt: number, now: number): string {
  const elapsedMs = Math.max(0, now - createdAt);
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}
