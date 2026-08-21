/**
 * Exponential backoff for outbox retries after a network failure (design doc §3.2 point 4:
 * "네트워크 오류 → 'pending' 유지, 지수 backoff(next_retry_at)").
 *
 * attempt 1 -> 2s, attempt 2 -> 4s, attempt 3 -> 8s, ... capped at MAX_DELAY_MS so a long
 * offline stretch doesn't push the next retry hours away once connectivity actually returns.
 *
 * OFF-115 note: an earlier revision of this comment claimed the connectivity-watcher/foreground
 * triggers flush "regardless of next_retry_at" -- they never did (connectivity.ts just calls
 * flushOutbox, and every pass honors the backoff window). The cap therefore does double duty:
 * besides bounding the retry cadence, it is the invariant flushOutboxPass's clock-anomaly rule
 * relies on -- a stored next_retry_at can never legitimately sit more than MAX_DELAY_MS past
 * the current wall clock, so anything further out proves a backward clock jump and is clamped
 * to "due now" (see sync-engine.ts). Keep that invariant in mind before changing the cap.
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
