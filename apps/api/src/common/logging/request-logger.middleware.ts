import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/authenticated-request";
import { loggablePath } from "./loggable-path";

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
 * **직렬화되는 필드의 전부**(라운드 74 트랙 A 계약 ⓐ).
 *
 * 이 모듈의 주석은 오래 "only this fixed, pre-approved field set is ever serialized"라고
 * 약속했지만 그 집합은 **주석에만 있었고**, 그 줄을 세는 것은 저장소 전체에서 0건이었다.
 * 이제 목록이 값이다: `apps/api/test/request-log-fields.test.ts`가 실제로 나간 줄의 키를
 * 이 배열과 **정확히** 대조하고(밖의 키 0건 — 부정 단언), 아래 `RequestLogEntry` 타입이
 * 같은 집합을 컴파일 시점에도 잠근다.
 *
 * `userId`만 선택이다(인증된 요청에서만 붙는다). 헤더·본문·질의 문자열·인증 자료는 여기에
 * 없고, `path`에 실려 들어오던 초대 토큰은 `loggablePath`가 라우트 모양으로 가린다.
 */
export const REQUEST_LOG_FIELDS = [
  "ts",
  "level",
  "requestId",
  "method",
  "path",
  "status",
  "durationMs",
  "userId"
] as const;

export type RequestLogField = (typeof REQUEST_LOG_FIELDS)[number];

/**
 * 위 목록의 타입 쪽 사본. 객체 리터럴에 목록 밖의 키를 더하면 여기서 먼저 막힌다
 * (TypeScript의 초과 속성 검사).
 */
type RequestLogEntry = {
  ts: string;
  level: LogLevel;
  requestId: string | undefined;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  userId?: string;
};

/**
 * Logs one JSON line per completed request. The serialized field set is
 * REQUEST_LOG_FIELDS above -- {ts, level, requestId, method, path, status,
 * durationMs, userId?} -- and nothing else: no headers, body, query params, or
 * auth material (Authorization/token/password).
 *
 * `path` is NOT the raw request path: it goes through `loggablePath`, which
 * replaces secret-bearing path parameters with the route shape
 * (`/invite/9f3c…` -> `/invite/:token`). See loggable-path.ts for the list of
 * masked routes, the reasoned exemptions, and why no part of the token is kept.
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

      const entry: RequestLogEntry = {
        ts: new Date().toISOString(),
        level,
        requestId: Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader,
        method: req.method,
        path: loggablePath(req.path ?? req.url),
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
