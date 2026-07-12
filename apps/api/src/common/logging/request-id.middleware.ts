import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Accepts an inbound `x-request-id` header (trusted upstream/gateway value) or
 * generates one, normalizes it onto `req.headers["x-request-id"]` (so
 * GlobalExceptionFilter's existing `requestIdFrom(request)` reads the same
 * value without any changes to that file), and echoes it back on the
 * response header for client-side correlation.
 */
export function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers["x-request-id"];
    const fromHeader = (Array.isArray(incoming) ? incoming[0] : incoming)?.trim();
    const requestId = fromHeader && fromHeader.length > 0 ? fromHeader : randomUUID();
    req.headers["x-request-id"] = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  };
}
