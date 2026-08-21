import { BadRequestException, Logger, type ArgumentsHost } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";

/**
 * SEC-115 F1: a non-HttpException reaching the global filter must now leave a
 * server-side error log line (requestId + message/stack) so 500s are
 * diagnosable — while the client-visible envelope stays exactly as before
 * (generic code/message only; no exception internals may leak into it).
 */
function createHost(headers: Record<string, string | string[] | undefined> = {}) {
  const captured: { statusCode?: number; body?: unknown } = {};
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
      getResponse: () => ({
        status: (statusCode: number) => {
          captured.statusCode = statusCode;
          return {
            json: (body: unknown) => {
              captured.body = body;
            }
          };
        }
      })
    })
  } as unknown as ArgumentsHost;
  return { host, captured };
}

describe("GlobalExceptionFilter server-side logging (SEC-115 F1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs requestId + message + stack for a non-HttpException, while the 500 envelope stays generic and leaks nothing", () => {
    const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const { host, captured } = createHost({ "x-request-id": "req-sec115-f1" });
    const thrown = new Error("secret-db-password=hunter2 connection refused");

    new GlobalExceptionFilter().catch(thrown, host);

    // Response envelope: unchanged generic 500 shape, nothing from the exception.
    expect(captured.statusCode).toBe(500);
    expect(captured.body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "잠시 후 다시 시도해주세요.",
        details: undefined,
        requestId: "req-sec115-f1"
      }
    });
    expect(JSON.stringify(captured.body)).not.toContain("hunter2");
    expect(JSON.stringify(captured.body)).not.toContain("connection refused");

    // Server log: exactly one error line carrying requestId, message, and stack.
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [logMessage, logStack] = errorSpy.mock.calls[0];
    expect(String(logMessage)).toContain("req-sec115-f1");
    expect(String(logMessage)).toContain("secret-db-password=hunter2 connection refused");
    expect(String(logStack)).toContain("Error: secret-db-password=hunter2");
  });

  it("logs a stringified value for a non-Error throw and still mints a requestId when the header is absent", () => {
    const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const { host, captured } = createHost();

    new GlobalExceptionFilter().catch("plain-string-failure", host);

    expect(captured.statusCode).toBe(500);
    const body = captured.body as { error: { code: string; requestId: string } };
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.requestId).toEqual(expect.any(String));
    expect(JSON.stringify(captured.body)).not.toContain("plain-string-failure");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain("plain-string-failure");
  });

  it("does NOT add an error log for an ordinary HttpException (expected 4xx flow stays quiet)", () => {
    const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const { host, captured } = createHost({ "x-request-id": "req-sec115-4xx" });

    new GlobalExceptionFilter().catch(
      new BadRequestException({ code: "VALIDATION_ERROR", message: "요청 값을 다시 확인해주세요." }),
      host
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({
      error: { code: "VALIDATION_ERROR", requestId: "req-sec115-4xx" }
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
