import { createHmac } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import Redis from "ioredis";

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_GLOBAL_MAX = 300;
const DEFAULT_AUTH_MAX = 30;

// api/v1 is the global prefix set in bootstrap.ts's configureApiApp; this
// middleware runs at the raw Express level (registered before Nest's router
// is mounted), so it sees the request path exactly as sent by the client,
// including that prefix.
const AUTH_PATH_PATTERN = /^\/api\/v1\/(admin\/)?auth\//;
const HIGH_RISK_PATH_PATTERN = /^\/api\/v1\/(?:admin\/auth\/|auth\/|privacy\/(?:account-deletion|data-export)|settings\/account\/delete-confirm)/;

type Bucket = { count: number; windowStart: number };

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clientKey(req: Request): string {
  const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
  const salt = process.env.RATE_LIMIT_KEY_SALT ?? "wooriai-dev-rate-limit-salt";
  return createHmac("sha256", salt).update(ip).digest("hex");
}

function requestIdOf(req: Request): string | undefined {
  const header = req.headers["x-request-id"];
  return Array.isArray(header) ? header[0] : header;
}

/**
 * Redis-backed, HMAC-keyed rate limiter. A global ceiling (default 300 req/min)
 * applies to every request; `auth/*` and `admin/auth/*` additionally obey a
 * much tighter ceiling (default 30 req/min). Non-production may use the bounded
 * local fallback; production high-risk routes fail closed if Redis is absent.
 * brute-force-sensitive endpoints (on top of admin login's existing
 * email+IP attempt limiter in AdminAuthService, which is unrelated and
 * unaffected by this).
 *
 * Test isolation: limits are read from RATE_LIMIT_GLOBAL_MAX /
 * RATE_LIMIT_AUTH_MAX / RATE_LIMIT_WINDOW_MS env vars on every request (not
 * captured once at startup), and each call to this factory creates a fresh,
 * closure-scoped bucket Map -- so a dedicated test can set very low limits
 * for its own app instance without affecting any other test file's app when
 * REDIS_URL is unset.
 */
export function rateLimitMiddleware() {
  const buckets = new Map<string, Bucket>();
  const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null
      })
    : null;
  redis?.on("error", () => undefined);
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

  async function checkDistributed(key: string, max: number, windowMs: number): Promise<boolean> {
    if (!redis) throw new Error("REDIS_RATE_LIMIT_UNAVAILABLE");
    const result = await redis.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return n",
      1,
      `ratelimit:${key}`,
      String(windowMs)
    );
    return Number(result) <= max;
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const windowMs = envInt("RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS);
    const globalMax = envInt("RATE_LIMIT_GLOBAL_MAX", DEFAULT_GLOBAL_MAX);
    const authMax = envInt("RATE_LIMIT_AUTH_MAX", DEFAULT_AUTH_MAX);
    const identity = clientKey(req);
    const path = req.path ?? req.url ?? "";
    const highRisk = HIGH_RISK_PATH_PATTERN.test(path);
    const useDistributed = Boolean(redis);
    void (async () => {
      try {
        const withinGlobal = useDistributed
          ? await checkDistributed(`global:${identity}`, globalMax, windowMs)
          : checkAndIncrement(`global:${identity}`, globalMax, windowMs);
        const withinAuth = !AUTH_PATH_PATTERN.test(path) || (useDistributed
          ? await checkDistributed(`auth:${identity}`, authMax, windowMs)
          : checkAndIncrement(`auth:${identity}`, authMax, windowMs));
        if (!withinGlobal || !withinAuth) {
          res.setHeader("Retry-After", Math.ceil(windowMs / 1000).toString());
          res.status(429).json({ error: { code: "RATE_LIMITED", message: "요청이 너무 많아요. 잠시 후 다시 시도해주세요.", requestId: requestIdOf(req) } });
          return;
        }
        next();
      } catch {
        if (process.env.NODE_ENV === "production" && highRisk) {
          res.status(503).json({ error: { code: "RATE_LIMIT_UNAVAILABLE", message: "보호 기능을 확인할 수 없어 잠시 요청을 처리할 수 없어요.", requestId: requestIdOf(req) } });
          return;
        }
        const withinFallback = checkAndIncrement(`fallback:${identity}`, highRisk ? authMax : globalMax, windowMs);
        if (!withinFallback) {
          res.status(429).json({ error: { code: "RATE_LIMITED", message: "요청이 너무 많아요. 잠시 후 다시 시도해주세요.", requestId: requestIdOf(req) } });
          return;
        }
        next();
      }
    })();
  };
}
