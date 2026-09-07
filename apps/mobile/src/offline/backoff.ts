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

/**
 * F5 — **예약해 둔 백오프 창을 실제로 깨울 시각.**
 *
 * ## 종전과 그 끝
 *
 * 위 두 함수는 `next_retry_at`을 **적기만** 했다. 그때는 그것으로 충분하다고 보였다 — 위
 * OFF-115 주석이 적어 둔 대로 모든 pass가 그 창을 존중하므로, 창은 "다음 트리거가 왔을 때
 * 이 행을 보낼지"를 가르는 값이었다. **그런데 그 "다음 트리거"가 시간과 무관하다.** 저장소
 * 전수 실측: 아웃박스를 깨우는 자리는 토큰 진입 1회 + 오프라인→온라인 전이 + 앱 포그라운드
 * 복귀 + 로컬 쓰기뿐이고, `next_retry_at`을 읽어 타이머를 거는 코드는 **0건**이었다.
 *
 * 그 사이 화면은 *"서버가 잠시 응답하지 못했어요. **자동으로 다시 시도해요.**"*
 * (sync-engine.ts `SERVER_TRANSIENT_ERROR_MESSAGE`)라고 말한다. 앱을 계속 켜 둔 채 온라인으로
 * 기다리는 사용자에게 그 문장은 거짓이었다 — 앱을 백그라운드로 보냈다 돌아오거나 기록을 하나
 * 더 적기 전까지 아무 요청도 나가지 않는다.
 *
 * ## 이 함수가 답하는 것
 *
 * 큐가 들고 있는 창들 중 **가장 이른 미래 시각까지 몇 ms인가**. 없으면 `null`(= 걸 타이머 없음).
 *
 * ⚠️ **이미 지난 창은 세지 않는다 — 이것이 폭주를 막는 자리다.** 방금 끝난 pass가 그 창을
 * 이미 봤다는 뜻이고(지나갔는데도 남아 있다면 그 행은 pass가 건너뛰는 행 — 예컨대 'failed'로
 * 굳은 뒤 옛 창만 남은 아웃박스 행이다), 0ms 타이머를 걸면 **깨움 → 아무것도 못 보냄 → 같은
 * 창을 다시 읽음**의 무한 루프가 된다. 미래만 세면 타이머가 한 번 발화한 순간 그 창은 과거가
 * 되므로 같은 창으로 두 번 깨어날 수 없다.
 *
 * ⚠️ **상한은 `MAX_DELAY_MS`다.** 위 OFF-115 불변식(저장된 창은 현재 시각보다 MAX_DELAY_MS
 * 넘게 미래일 수 없다)의 재사용이자, `setTimeout`의 32비트 한계(2^31-1ms를 넘는 지연은 **즉시**
 * 발화한다)를 넘지 않기 위한 방어다 — 뒤로 뛴 시계가 만든 먼 창 하나가 그 한계를 넘겨 타이머를
 * 즉시 발화 루프로 바꾸는 것이 폭주의 유일한 다른 길이었다.
 */
export function nextBackoffWakeDelayMs(
  rows: readonly { nextRetryAt?: string | null }[],
  nowMs: number
): number | null {
  let earliest: number | null = null;
  for (const row of rows) {
    if (!row.nextRetryAt) continue;
    const at = new Date(row.nextRetryAt).getTime();
    if (Number.isNaN(at)) continue;
    if (at <= nowMs) continue;
    if (earliest === null || at < earliest) earliest = at;
  }
  if (earliest === null) return null;
  return Math.min(earliest - nowMs, MAX_DELAY_MS);
}
