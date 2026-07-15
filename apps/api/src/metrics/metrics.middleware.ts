import type { NextFunction, Request, Response } from "express";
import { observeRequest } from "./metrics.registry";

export function metricsMiddleware() {
  return (request: Request, response: Response, next: NextFunction) => {
    const startedAt = Date.now();
    response.on("finish", () => {
      observeRequest(request.method, request.path ?? request.url, response.statusCode, Date.now() - startedAt);
    });
    next();
  };
}
