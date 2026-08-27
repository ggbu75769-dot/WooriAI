import {
  BadRequestException,
  Controller,
  Logger,
  Module,
  PayloadTooLargeException,
  Post,
  UploadedFile,
  UseInterceptors,
  type ArgumentsHost,
  type INestApplication
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GlobalExceptionFilter,
  IMPORT_FILE_TOO_LARGE_CODE,
  IMPORT_FILE_TOO_LARGE_MESSAGE
} from "../src/common/filters/global-exception.filter";

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

// ---------------------------------------------------------------------------
// API-130: 업로드(multer) 거절 정규화
// ---------------------------------------------------------------------------

/**
 * multer가 실제로 던지는 오류 모양 — `name === "MulterError"` + `code`.
 * (apps/api는 multer를 직접 의존하지 않으므로 필터도 테스트도 구조로만 다룬다.)
 */
function multerError(code: string, message: string): Error {
  const error = new Error(message);
  error.name = "MulterError";
  (error as Error & { code: string }).code = code;
  return error;
}

describe("GlobalExceptionFilter 업로드 거절 매핑 (API-130)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("원본 MulterError(LIMIT_FILE_SIZE)를 500이 아니라 413 IMPORT_FILE_TOO_LARGE로 매핑한다", () => {
    const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const { host, captured } = createHost({ "x-request-id": "req-api130-size" });

    new GlobalExceptionFilter().catch(multerError("LIMIT_FILE_SIZE", "File too large"), host);

    expect(captured.statusCode).toBe(413);
    expect(captured.body).toEqual({
      error: {
        code: IMPORT_FILE_TOO_LARGE_CODE,
        message: IMPORT_FILE_TOO_LARGE_MESSAGE,
        details: undefined,
        requestId: "req-api130-size"
      }
    });
    // 사용자 입력 문제이므로 500 오류 로그를 남기지 않는다(다른 4xx와 동일).
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("Nest가 이미 감싼 PayloadTooLargeException('File too large')도 같은 413 봉투로 정규화한다", () => {
    // FileInterceptor는 multer 오류를 transformException으로 감싸 넘긴다. 상태코드는
    // 413이지만 code가 없어 예전에는 INTERNAL_SERVER_ERROR + 영문 원문이 나갔다.
    const { host, captured } = createHost({ "x-request-id": "req-api130-wrapped" });

    new GlobalExceptionFilter().catch(new PayloadTooLargeException("File too large"), host);

    expect(captured.statusCode).toBe(413);
    expect(captured.body).toMatchObject({
      error: { code: IMPORT_FILE_TOO_LARGE_CODE, message: IMPORT_FILE_TOO_LARGE_MESSAGE }
    });
    expect(JSON.stringify(captured.body)).not.toContain("File too large");
  });

  it("크기 외 multer 오류는 400 일반 검증 오류로 매핑한다 (원본/감싼 형태 모두)", () => {
    const raw = createHost({ "x-request-id": "req-api130-raw" });
    new GlobalExceptionFilter().catch(multerError("LIMIT_UNEXPECTED_FILE", "Unexpected field"), raw.host);
    expect(raw.captured.statusCode).toBe(400);
    expect(raw.captured.body).toMatchObject({
      error: { code: "VALIDATION_ERROR", message: "요청 값을 다시 확인해주세요." }
    });

    const wrapped = createHost({ "x-request-id": "req-api130-wrapped-400" });
    new GlobalExceptionFilter().catch(new BadRequestException("Unexpected field"), wrapped.host);
    expect(wrapped.captured.statusCode).toBe(400);
    expect(wrapped.captured.body).toMatchObject({
      error: { code: "VALIDATION_ERROR", message: "요청 값을 다시 확인해주세요." }
    });
  });

  it("우리가 직접 던진 업로드 예외(fileFilter의 IMPORT_FILE_TYPE_INVALID)는 그대로 통과시킨다", () => {
    const { host, captured } = createHost({ "x-request-id": "req-api130-passthrough" });

    new GlobalExceptionFilter().catch(
      new BadRequestException({ code: "IMPORT_FILE_TYPE_INVALID", message: "Only csv or xlsx files are allowed." }),
      host
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({
      error: { code: "IMPORT_FILE_TYPE_INVALID", message: "Only csv or xlsx files are allowed." }
    });
  });

  it("413이 아닌 평범한 PayloadTooLarge 문구는 건드리지 않는다 (multer 원문만 정규화)", () => {
    const { host, captured } = createHost();
    new GlobalExceptionFilter().catch(new PayloadTooLargeException("무언가 다른 이유"), host);
    expect(captured.statusCode).toBe(413);
    expect(captured.body).toMatchObject({ error: { message: "무언가 다른 이유" } });
  });
});

// 실제 multer + FileInterceptor + 필터를 함께 태워, 10MB 상한을 흉내낸 작은
// limit로 멀티파트 업로드가 413 봉투로 나가는지 확인한다 (실 10MB 페이로드를
// 만들지 않고 같은 코드 경로를 통과시키는 방법).
@Controller()
class TinyLimitUploadController {
  @Post("upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 32 } }))
  upload(@UploadedFile() file: unknown) {
    return { received: Boolean(file) };
  }
}

@Module({ controllers: [TinyLimitUploadController] })
class TinyLimitUploadModule {}

describe("업로드 크기 초과 통합 (API-130)", () => {
  it("multer limits.fileSize를 넘긴 멀티파트 업로드가 413 IMPORT_FILE_TOO_LARGE 봉투로 나간다", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TinyLimitUploadModule] }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    try {
      const tooBig = await request(app.getHttpServer())
        .post("/upload")
        .attach("file", Buffer.alloc(64, 0x41), "big.csv")
        .expect(413);

      expect(tooBig.body.error).toMatchObject({
        code: IMPORT_FILE_TOO_LARGE_CODE,
        message: IMPORT_FILE_TOO_LARGE_MESSAGE,
        requestId: expect.any(String)
      });

      // 상한 이하 업로드는 그대로 통과 (정상 경로 불변).
      await request(app.getHttpServer())
        .post("/upload")
        .attach("file", Buffer.from("ok", "utf8"), "small.csv")
        .expect(201)
        .expect(({ body }) => expect(body).toEqual({ received: true }));
    } finally {
      await app.close();
    }
  });
});
