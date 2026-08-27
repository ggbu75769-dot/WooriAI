import { createHmac } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { safeCompare } from "../../auth/token.service";
import { requireSecret } from "../config/require-secret";

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_GLOBAL_MAX = 300;
const DEFAULT_AUTH_MAX = 30;
const DEFAULT_REDIRECT_MAX = 60;
// SEC-132: raised from 30 to 60. See the ANALYTICS_PATH_PATTERN comment below —
// once every *successful* analytics write also has to pass the per-account
// bucket, the per-IP bucket no longer has to be the primary abuse control for
// authenticated traffic, and its old 30/min ceiling was mostly a false-block
// generator behind carrier NAT.
const DEFAULT_ANALYTICS_MAX = 60;
const DEFAULT_ANALYTICS_USER_MAX = 60;

// api/v1 is the global prefix set in bootstrap.ts's configureApiApp; this
// middleware runs at the raw Express level (registered before Nest's router
// is mounted), so it sees the request path exactly as sent by the client,
// including that prefix.
const AUTH_PATH_PATTERN = /^\/api\/v1\/(admin\/)?auth\//;

// SEC-115 F3: the public affiliate redirect (GET /api/v1/r/:code) performs an
// affiliate_clicks INSERT per request, so under the global-only ceiling one IP
// could write 300 rows/min. 60 req/min is still far beyond any human
// click-through pace (1/sec sustained) but caps the write amplification.
const REDIRECT_PATH_PATTERN = /^\/api\/v1\/r\//;

// SEC-130: analytics collection is the only endpoint where ONE request writes
// MANY rows — POST /api/v1/analytics/events accepts a batch of up to
// ANALYTICS_EVENTS_BATCH_MAX (= 50, analytics.service.ts) envelopes and inserts
// one analytics_events row per accepted event. Under the global-only ceiling
// (300 req/min) a single IP could therefore drive 300 × 50 = 15,000 inserts per
// minute — two orders of magnitude above any other endpoint's per-request write
// amplification, and the cheapest way to bloat the analytics table (which the
// admin KPI aggregates then have to scan). A dedicated 30 req/min bucket caps
// that at 30 × 50 = 1,500 rows/min per IP while leaving the mobile client
// enormous headroom: it flushes its queue in batches every few minutes, i.e.
// well under 1 req/min per device. Being authenticated (JwtAuthGuard) does not
// make the endpoint safe on its own — one valid token plus a loop is all an
// abuser needs, and the auth/* bucket does not cover this path.
//
// SEC-132: the IP bucket alone was both too coarse and too narrow.
//   - Too coarse: behind carrier-grade NAT (the normal case for Korean mobile
//     networks) hundreds of devices egress from one address, so they all share
//     one bucket and a busy cell can 429 users who did nothing wrong.
//   - Too narrow: it keys on something the abuser controls. One token replayed
//     from rotating IPs (proxy pool, tethering, a handful of VPN exits) never
//     fills any single IP bucket, which was the acknowledged residual of the
//     Round 30 P3 review.
// The fix is a SECOND bucket keyed on the authenticated user id, ANDed with the
// IP bucket: a request is admitted only if it fits under both. The account
// bucket is what actually bounds sustained writes now (60 req/min × 50 rows =
// 3,000 rows/min per account, no matter how many IPs the caller rotates
// through), which is why the IP ceiling could be relaxed to 60 — its remaining
// job is only to blunt unauthenticated/invalid-token floods (those never reach
// a user bucket), and those are already covered by the global 300/min ceiling.
// Sizing: the mobile client flushes its queue every few minutes, i.e. well
// under 1 req/min per device, so 60/min leaves roughly two orders of magnitude
// of headroom even for a user running several devices on one account.
const ANALYTICS_PATH_PATTERN = /^\/api\/v1\/analytics\/events\/?$/;

/**
 * SEC-132: the authenticated user id for the account-scoped analytics bucket.
 *
 * This middleware runs at the raw Express level, *before* Nest's router and
 * therefore before JwtAuthGuard — `req.user` does not exist yet. Reading the
 * `sub` claim out of the JWT without checking the signature would be worse than
 * useless: the payload is unencrypted base64url, so an abuser could mint a
 * fresh forged `sub` per request and get an unlimited supply of buckets. So we
 * verify the HMAC here, exactly the way TokenService.verifyToken does (same
 * secret, same HS256 signing input, same type/exp checks, same legacy
 * `id`-instead-of-`sub` tolerance from SEC-131). That is cheap and stateless —
 * no DB round-trip, no DI — and it is what lets the check stay in the
 * middleware instead of moving to a guard or interceptor: the limiter has to
 * keep rejecting *before* body parsing, which is exactly the cost this endpoint
 * is being protected from.
 *
 * Anything we cannot verify returns null and is charged to no user bucket; such
 * a request is heading for a 401 at the guard anyway, and the IP bucket still
 * applies. The e2e tests drive this with tokens minted by the real login flow,
 * so a change to the token format breaks them loudly instead of silently
 * degrading this back to IP-only.
 */
function accessTokenSubject(req: Request): string | null {
  const header = req.headers?.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith("Bearer ")) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = value.slice("Bearer ".length).trim().split(".");
  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  try {
    const secret = requireSecret("JWT_ACCESS_SECRET", "wooriai-dev-access-secret");
    const expected = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
    if (!safeCompare(signature, expected)) {
      return null;
    }

    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      sub?: unknown;
      id?: unknown;
      type?: unknown;
      exp?: unknown;
    };
    if (parsed.type !== "access") {
      return null;
    }
    if (typeof parsed.exp !== "number" || parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return typeof parsed.sub === "string" ? parsed.sub : typeof parsed.id === "string" ? parsed.id : null;
  } catch {
    // Malformed base64/JSON, or a missing secret in a misconfigured deploy:
    // bucket bookkeeping must never turn a request into a 500.
    return null;
  }
}

type Bucket = { count: number; windowStart: number };

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

function requestIdOf(req: Request): string | undefined {
  const header = req.headers["x-request-id"];
  return Array.isArray(header) ? header[0] : header;
}

/**
 * In-memory, per-IP rate limiter. Keys on req.ip — behind a reverse proxy
 * (Caddy/Fly) this is only the real client IP when TRUST_PROXY=1 is set so
 * bootstrap.ts's configureApiApp enables Express `trust proxy` (1 hop);
 * without it every request would share the proxy's IP and collapse into one
 * global bucket. A global ceiling (default 300 req/min)
 * applies to every request; `auth/*` and `admin/auth/*` additionally obey a
 * much tighter ceiling (default 30 req/min) since those are the
 * brute-force-sensitive endpoints (on top of admin login's existing
 * email+IP attempt limiter in AdminAuthService, which is unrelated and
 * unaffected by this), and the public affiliate redirect `r/*` obeys its own
 * ceiling (default 60 req/min) since each request inserts an
 * affiliate_clicks row (SEC-115 F3). `POST analytics/events` likewise obeys
 * its own ceiling (default 60 req/min) since each request inserts up to 50
 * analytics_events rows (SEC-130), and — because an IP is neither a stable nor
 * an attacker-proof identity — additionally obeys a per-account ceiling
 * (default 60 req/min) keyed on the verified JWT subject, ANDed with the IP
 * bucket (SEC-132).
 *
 * Test isolation: limits are read from RATE_LIMIT_GLOBAL_MAX /
 * RATE_LIMIT_AUTH_MAX / RATE_LIMIT_REDIRECT_MAX / RATE_LIMIT_ANALYTICS_MAX /
 * RATE_LIMIT_ANALYTICS_USER_MAX / RATE_LIMIT_WINDOW_MS env
 * vars on every request (not
 * captured once at startup), and each call to this factory creates a fresh,
 * closure-scoped bucket Map -- so a dedicated test can set very low limits
 * for its own app instance without affecting any other test file's app.
 */
export function rateLimitMiddleware() {
  const buckets = new Map<string, Bucket>();
  // 오래된 버킷을 주기적으로 청소해 유니크 IP가 많아도 맵이 무한히 자라지 않게 한다.
  const PRUNE_THRESHOLD = 10_000;

  function pruneExpired(now: number, windowMs: number) {
    if (buckets.size < PRUNE_THRESHOLD) {
      return;
    }
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart > windowMs) {
        buckets.delete(key);
      }
    }
  }

  function checkAndIncrement(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    pruneExpired(now, windowMs);
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart > windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (bucket.count >= max) {
      return false;
    }
    bucket.count += 1;
    return true;
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const windowMs = envInt("RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS);
    const globalMax = envInt("RATE_LIMIT_GLOBAL_MAX", DEFAULT_GLOBAL_MAX);
    const authMax = envInt("RATE_LIMIT_AUTH_MAX", DEFAULT_AUTH_MAX);
    const redirectMax = envInt("RATE_LIMIT_REDIRECT_MAX", DEFAULT_REDIRECT_MAX);
    const analyticsMax = envInt("RATE_LIMIT_ANALYTICS_MAX", DEFAULT_ANALYTICS_MAX);
    const analyticsUserMax = envInt("RATE_LIMIT_ANALYTICS_USER_MAX", DEFAULT_ANALYTICS_USER_MAX);
    const ip = clientIp(req);
    const path = req.path ?? req.url ?? "";

    const withinGlobal = checkAndIncrement(`global:${ip}`, globalMax, windowMs);
    const withinAuth = !AUTH_PATH_PATTERN.test(path) || checkAndIncrement(`auth:${ip}`, authMax, windowMs);
    const withinRedirect =
      !REDIRECT_PATH_PATTERN.test(path) || checkAndIncrement(`redirect:${ip}`, redirectMax, windowMs);
    // Method-scoped (unlike the other buckets): only the POST collection call
    // writes rows, so a future read-only analytics endpoint would not be
    // throttled by the write budget.
    const isAnalyticsWrite = req.method === "POST" && ANALYTICS_PATH_PATTERN.test(path);
    const withinAnalytics = !isAnalyticsWrite || checkAndIncrement(`analytics:${ip}`, analyticsMax, windowMs);
    // SEC-132: the account-scoped companion bucket. Charged independently of
    // the IP bucket above (both are always incremented for an analytics write)
    // so the two ceilings stay genuinely independent — an IP that is already
    // over its limit does not thereby spare, or consume, anyone's account
    // budget. The key prefix differs from the IP bucket's, and subjects are
    // UUIDs, so the two key spaces cannot collide.
    const withinAnalyticsUser = ((): boolean => {
      if (!isAnalyticsWrite) {
        return true;
      }
      const subject = accessTokenSubject(req);
      return subject === null || checkAndIncrement(`analytics-user:${subject}`, analyticsUserMax, windowMs);
    })();

    if (!withinGlobal || !withinAuth || !withinRedirect || !withinAnalytics || !withinAnalyticsUser) {
      res.setHeader("Retry-After", Math.ceil(windowMs / 1000).toString());
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "요청이 너무 많아요. 잠시 후 다시 시도해주세요.",
          requestId: requestIdOf(req)
        }
      });
      return;
    }

    next();
  };
}
