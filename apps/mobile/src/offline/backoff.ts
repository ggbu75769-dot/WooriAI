/**
 * Exponential backoff for outbox retries after a network failure (design doc §3.2 point 4:
 * "네트워크 오류 → 'pending' 유지, 지수 backoff(next_retry_at)").
 *
 * attempt 1 -> 2s, attempt 2 -> 4s, attempt 3 -> 8s, ... capped at MAX_DELAY_MS so a long
 * offline stretch doesn't push the next retry hours away once connectivity actually returns
 * (the connectivity-watcher/foreground triggers in connectivity.ts fire an immediate flush
 * regardless of next_retry_at, so the cap mostly matters for the automatic timer-based path).
 */
export const BASE_DELAY_MS = 2_000;
export const MAX_DELAY_MS = 5 * 60 * 1_000;

export function computeBackoffDelayMs(attemptCount: number): number {
  const exponent = Math.max(0, attemptCount - 1);
  const delay = BASE_DELAY_MS * 2 ** exponent;
  return Math.min(delay, MAX_DELAY_MS);
}

export function computeNextRetryAtIso(nowIso: string, attemptCount: number): string {
  const delayMs = computeBackoffDelayMs(attemptCount);
  return new Date(new Date(nowIso).getTime() + delayMs).toISOString();
}
