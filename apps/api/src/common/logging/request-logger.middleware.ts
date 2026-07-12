import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/authenticated-request";

const LEVEL_ORDER = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof LEVEL_ORDER;

function configuredLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return raw in LEVEL_ORDER ? (raw as LogLevel) : "info";
}

function shouldLog(): boolean {
  // Quiet by default under the vitest test env (NODE_ENV=test) unless a
  // level is explicitly requested via LOG_LEVEL, so `pnpm test` output isn't
  // flooded with one JSON line per request across dozens of e2e suites.
  if (process.env.NODE_ENV === "test" && !process.env.LOG_LEVEL) {
    return false;
  }
  return true;
}

/**
 * Logs one JSON line per completed request: {ts, level, requestId, method,
 * path, status, durationMs, userId?}. Deliberately never includes headers,
 * body, query params, or any auth material (Authorization/token/password) --
 * only this fixed, pre-approved field set is ever serialized.
 */
export function requestLoggerMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on("finish", () => {
      if (!shouldLog()) return;

      const level: LogLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
      if (LEVEL_ORDER[level] > LEVEL_ORDER[configuredLevel()]) return;

      const requestIdHeader = req.headers["x-request-id"];
      const authenticated = req as AuthenticatedRequest;

      const entry = {
        ts: new Date().toISOString(),
        level,
        requestId: Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader,
        method: req.method,
        path: req.path ?? req.url,
        status: res.statusCode,
        durationMs: Date.now() - start,
        ...(authenticated.user?.id || authenticated.adminUser?.id
          ? { userId: authenticated.user?.id ?? authenticated.adminUser?.id }
          : {})
      };

      // eslint-disable-next-line no-console
      console.log(JSON.stringify(entry));
    });

    next();
  };
}
