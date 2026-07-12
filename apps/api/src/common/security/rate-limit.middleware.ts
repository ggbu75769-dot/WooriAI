import type { NextFunction, Request, Response } from "express";

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_GLOBAL_MAX = 300;
const DEFAULT_AUTH_MAX = 30;

// api/v1 is the global prefix set in bootstrap.ts's configureApiApp; this
// middleware runs at the raw Express level (registered before Nest's router
// is mounted), so it sees the request path exactly as sent by the client,
// including that prefix.
const AUTH_PATH_PATTERN = /^\/api\/v1\/(admin\/)?auth\//;

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
 * In-memory, per-IP rate limiter. A global ceiling (default 300 req/min)
 * applies to every request; `auth/*` and `admin/auth/*` additionally obey a
 * much tighter ceiling (default 30 req/min) since those are the
 * brute-force-sensitive endpoints (on top of admin login's existing
 * email+IP attempt limiter in AdminAuthService, which is unrelated and
 * unaffected by this).
 *
 * Test isolation: limits are read from RATE_LIMIT_GLOBAL_MAX /
 * RATE_LIMIT_AUTH_MAX / RATE_LIMIT_WINDOW_MS env vars on every request (not
 * captured once at startup), and each call to this factory creates a fresh,
 * closure-scoped bucket Map -- so a dedicated test can set very low limits
 * for its own app instance without affecting any other test file's app.
 */
export function rateLimitMiddleware() {
  const buckets = new Map<string, Bucket>();

  function checkAndIncrement(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
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
    const ip = clientIp(req);
    const path = req.path ?? req.url ?? "";

    const withinGlobal = checkAndIncrement(`global:${ip}`, globalMax, windowMs);
    const withinAuth = !AUTH_PATH_PATTERN.test(path) || checkAndIncrement(`auth:${ip}`, authMax, windowMs);

    if (!withinGlobal || !withinAuth) {
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
