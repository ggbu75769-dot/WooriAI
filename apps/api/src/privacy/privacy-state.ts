export type PrivacyState =
  | "requested"
  | "access_revoked"
  | "processor_delete_queued"
  | "purging"
  | "retained_exception"
  | "completed"
  | "failed"
  | "cancelled";

const ALLOWED_TRANSITIONS: Record<PrivacyState, ReadonlySet<PrivacyState>> = {
  requested: new Set(["access_revoked", "processor_delete_queued", "cancelled", "failed"]),
  access_revoked: new Set(["processor_delete_queued", "failed"]),
  processor_delete_queued: new Set(["purging", "failed"]),
  purging: new Set(["completed", "retained_exception", "failed"]),
  retained_exception: new Set(["purging", "completed"]),
  completed: new Set(),
  failed: new Set(["processor_delete_queued", "purging", "cancelled"]),
  cancelled: new Set()
};

export function canTransitionPrivacyRequest(previous: PrivacyState, next: PrivacyState): boolean {
  return ALLOWED_TRANSITIONS[previous].has(next);
}
