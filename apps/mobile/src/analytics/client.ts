import { isAnalyticsEnabled } from "./flag";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";

/**
 * Mirrors packages/contracts/src/analytics.ts's event registry (ANA-101 §5).
 * Kept as a standalone literal union (not a cross-package import) so this
 * client stays a plain, dependency-free module Metro can bundle without a
 * new workspace dependency declaration -- keep this list in sync with the
 * contracts registry by hand when adding an event.
 */
export type AnalyticsEventName =
  | "app_opened"
  | "onboarding_completed"
  | "expense_recorded"
  | "expense_synced"
  | "expense_catalog_search_missed"
  | "item_status_changed"
  | "affiliate_link_clicked";

export type AnalyticsEnvelope = {
  eventName: AnalyticsEventName;
  eventVersion: number;
  eventId: string;
  occurredAt: string;
  appVersion?: string;
  platform?: "ios" | "android";
  payload: Record<string, unknown>;
};

export type TrackEventInput = {
  eventName: AnalyticsEventName;
  payload: Record<string, unknown>;
  eventVersion?: number;
  /** Caller-supplied (e.g. `Platform.OS` from the RN call site) -- this module
   * intentionally never imports "react-native" itself so it stays runnable
   * under plain vitest (see offline/sync-controller.ts's header comment for
   * why native-adjacent imports make a module effectively untestable here). */
  platform?: "ios" | "android";
  appVersion?: string;
};

/** POST /analytics/events accepts at most this many envelopes per request (round5a-sprint2-plan.md §5). */
const MAX_BATCH_SIZE = 50;
/** Best-effort local cap: a device offline for a long time must not grow this queue unbounded.
 * Analytics is non-critical, so the oldest queued events are dropped first rather than blocking
 * or erroring anything. */
const MAX_QUEUE_SIZE = 200;

let queue: AnalyticsEnvelope[] = [];

function randomUuidV4(): string {
  const bytes: number[] = [];
  for (let i = 0; i < 16; i += 1) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0"));
  return (
    `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-` +
    `${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
  );
}

/**
 * Queues one event envelope. A complete no-op while analytics is opted out
 * (the default -- see flag.ts): nothing is enqueued, so there is nothing
 * left sitting around to accidentally send later if consent changes.
 */
export function trackAnalyticsEvent(input: TrackEventInput): void {
  if (!isAnalyticsEnabled()) {
    return;
  }

  const envelope: AnalyticsEnvelope = {
    eventName: input.eventName,
    eventVersion: input.eventVersion ?? 1,
    eventId: randomUuidV4(),
    occurredAt: new Date().toISOString(),
    platform: input.platform,
    appVersion: input.appVersion,
    payload: input.payload
  };

  queue.push(envelope);
  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
  }
}

export function getQueuedAnalyticsEventCount(): number {
  return queue.length;
}

/**
 * Sends at most one batch (<=50 events) to the server. Best-effort and never
 * throws: on any failure (network error or non-2xx response) the batch is
 * put back at the front of the queue for a later attempt. Analytics must
 * never surface an error into, or block, the caller's own flow (onboarding
 * completion, offline expense sync).
 */
export async function flushAnalyticsQueue(token: string | null | undefined): Promise<void> {
  if (!isAnalyticsEnabled()) {
    return;
  }
  if (!token || queue.length === 0) {
    return;
  }

  const batch = queue.slice(0, MAX_BATCH_SIZE);
  queue = queue.slice(batch.length);

  try {
    const response = await fetch(`${API_BASE_URL}/analytics/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ events: batch })
    });
    if (!response.ok) {
      queue = [...batch, ...queue];
    }
  } catch {
    queue = [...batch, ...queue];
  }
}

/** Convenience for call sites: enqueue then attempt a fire-and-forget flush. Never throws. */
export function trackAndFlushAnalyticsEvent(token: string | null | undefined, input: TrackEventInput): void {
  trackAnalyticsEvent(input);
  void flushAnalyticsQueue(token);
}

/** Test-only: resets in-memory queue state between test cases. */
export function __resetAnalyticsClientForTests(): void {
  queue = [];
}

export type SyncLatencyBucket = "lt1s" | "1s_5s" | "5s_30s" | "30s_2m" | "gte2m";

/**
 * Buckets a duration (ms) into the same enum literal set as
 * packages/contracts/src/analytics.ts's expense_synced v1 payload's
 * latencyBucket field -- keep the boundaries in sync with that file.
 */
export function bucketSyncLatencyMs(durationMs: number): SyncLatencyBucket {
  if (durationMs < 1_000) return "lt1s";
  if (durationMs < 5_000) return "1s_5s";
  if (durationMs < 30_000) return "5s_30s";
  if (durationMs < 120_000) return "30s_2m";
  return "gte2m";
}
