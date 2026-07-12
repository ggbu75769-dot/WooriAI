import type { NextFunction, Request, Response } from "express";

/**
 * Baseline security headers applied to every API response.
 */
export function securityHeadersMiddleware() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    next();
  };
}
