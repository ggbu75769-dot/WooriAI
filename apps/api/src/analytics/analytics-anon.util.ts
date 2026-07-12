import { createHmac } from "node:crypto";
import { requireSecret } from "../common/config/require-secret";

/**
 * Dev/test fallback so the analytics endpoint works locally without an explicit
 * ANALYTICS_ANON_SALT env var. requireSecret enforces that any real deployment
 * (NODE_ENV outside development/test) must set the real env var instead of
 * silently falling back to this publicly-known value.
 */
const DEV_ANALYTICS_ANON_SALT_FALLBACK = "wooriai-dev-analytics-anon-salt";

function analyticsAnonSalt(): string {
  return requireSecret("ANALYTICS_ANON_SALT", DEV_ANALYTICS_ANON_SALT_FALLBACK);
}

/**
 * HMAC-SHA256(id, ANALYTICS_ANON_SALT) hex digest (round5a-sprint2-plan.md §5).
 * Always derived server-side from the authenticated user's own id / household
 * id -- callers must never pass through a client-supplied user_anon_id or
 * household_anon_id. hex digest of a 32-byte HMAC is 64 chars, matching the
 * analytics_events.user_anon_id/household_anon_id varchar(64) columns exactly.
 */
export function anonymizeId(id: string): string {
  return createHmac("sha256", analyticsAnonSalt()).update(id).digest("hex");
}
