import type { NextFunction, Request, Response } from "express";

type BodyParserError = Error & { type?: string; status?: number; statusCode?: number };

function isPayloadTooLarge(err: BodyParserError): boolean {
  return err.type === "entity.too.large" || err.status === 413 || err.statusCode === 413;
}

function requestIdOf(req: Request): string | undefined {
  const header = req.headers["x-request-id"];
  return Array.isArray(header) ? header[0] : header;
}

/**
 * A 4-arg Express error middleware, registered immediately after the
 * json/urlencoded body parsers. Body-parser's size-limit rejection is a
 * plain Error (not a NestJS HttpException), so without this it would fall
 * through to GlobalExceptionFilter's generic non-HttpException branch and
 * come back as a misleading 500 instead of 413. Must be registered after
 * requestIdMiddleware so `req.headers["x-request-id"]` is already populated
 * even when the body itself never finished parsing.
 */
export function bodySizeErrorMiddleware() {
  return (err: BodyParserError, req: Request, res: Response, next: NextFunction) => {
    if (!isPayloadTooLarge(err)) {
      next(err);
      return;
    }
    res.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "요청 본문이 너무 커요. 1MB 이하로 보내주세요.",
        requestId: requestIdOf(req)
      }
    });
  };
}
