import { randomUUID } from "node:crypto";
import {
  ArgumentsHost,
  Catch,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
  type ExceptionFilter
} from "@nestjs/common";

type HttpRequest = {
  headers?: Record<string, string | string[] | undefined>;
};

type HttpResponse = {
  status: (statusCode: number) => { json: (body: unknown) => void };
};

type ErrorResponseBody = {
  code?: string;
  message?: string | string[];
  details?: Record<string, unknown>;
  [extra: string]: unknown;
};

// Every response field besides these is treated as an extra top-level sibling
// of `error` (see below) rather than folded into it. Lets a specific thrown
// exception (e.g. VERSION_CONFLICT's `current`, design doc
// docs/5차/round5a-sprint1-plan.md §2.2) carry response data outside the
// `error` envelope without changing the shape of every other error response.
// `error`/`statusCode` are also excluded here (not just `code`/`message`/
// `details`): Nest's built-in HttpException short form (e.g.
// `new UnauthorizedException("...")`, used with no custom body object) always
// synthesizes `{message, error, statusCode}` -- without excluding those two,
// spreading `extra` would clobber our own `error` object with Nest's raw
// `error` *string* (its generic HTTP reason phrase, e.g. "Unauthorized").
const KNOWN_ERROR_BODY_KEYS = new Set(["code", "message", "details", "error", "statusCode"]);

function requestIdFrom(request: HttpRequest) {
  const header = request.headers?.["x-request-id"];
  if (Array.isArray(header)) {
    return header[0] ?? randomUUID();
  }
  return header ?? randomUUID();
}

function defaultCode(statusCode: number) {
  if (statusCode === HttpStatus.BAD_REQUEST) return "VALIDATION_ERROR";
  if (statusCode === HttpStatus.UNAUTHORIZED) return "UNAUTHORIZED";
  if (statusCode === HttpStatus.FORBIDDEN) return "FORBIDDEN";
  if (statusCode === HttpStatus.NOT_FOUND) return "NOT_FOUND";
  return "INTERNAL_SERVER_ERROR";
}

function defaultMessage(statusCode: number) {
  if (statusCode === HttpStatus.BAD_REQUEST) return "요청 값을 다시 확인해주세요.";
  if (statusCode === HttpStatus.UNAUTHORIZED) return "로그인이 필요해요.";
  if (statusCode === HttpStatus.FORBIDDEN) return "접근 권한이 없어요.";
  if (statusCode === HttpStatus.NOT_FOUND) return "요청한 API를 찾을 수 없어요.";
  return "잠시 후 다시 시도해주세요.";
}

function responseBodyFrom(exception: HttpException): ErrorResponseBody {
  const response = exception.getResponse();
  if (typeof response === "string") {
    return { message: response };
  }
  return response as ErrorResponseBody;
}

// ---------------------------------------------------------------------------
// API-130: 파일 업로드(multer) 거절을 우리 오류 봉투로 정규화
// ---------------------------------------------------------------------------

/**
 * 업로드 크기 상한 초과 응답. ImportPipelineService의 사전 검증(fileSizeBytes가
 * 상한을 넘는 경우)과 **같은 코드/문구**를 써야 하므로 여기(common 계층)를 단일
 * 소스로 두고 서비스가 가져다 쓴다 — 같은 실패를 클라이언트가 두 가지 문구로
 * 만나지 않게 하기 위함. 상태코드만 다르다(사전 검증은 400, 실제 스트림 초과는
 * 413).
 */
export const IMPORT_FILE_TOO_LARGE_CODE = "IMPORT_FILE_TOO_LARGE";
export const IMPORT_FILE_TOO_LARGE_MESSAGE = "Import files must be 10MB or smaller.";

/**
 * multer의 LIMIT_FILE_SIZE 오류 message 원문 (multer/lib/multer-error.js).
 * @nestjs/platform-express의 transformException도 이 message 문자열로 분기해
 * PayloadTooLargeException을 만든다.
 */
const MULTER_FILE_TOO_LARGE_MESSAGE = "File too large";

/** transformException이 400으로 바꾸는 나머지 multer/busboy 오류 message 원문. */
const MULTER_BAD_REQUEST_MESSAGES = new Set([
  "Too many parts",
  "Too many files",
  "Field name too long",
  "Field value too long",
  "Too many fields",
  "Unexpected field",
  "Field name missing",
  "Multipart: Boundary not found",
  "Multipart: Malformed part header",
  "Multipart: Unexpected end of form",
  "Multipart: Unexpected end of file"
]);

type NormalizedFailure = { statusCode: number; code: string; message: string };

const FILE_TOO_LARGE_FAILURE: NormalizedFailure = {
  statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
  code: IMPORT_FILE_TOO_LARGE_CODE,
  message: IMPORT_FILE_TOO_LARGE_MESSAGE
};

const MULTER_BAD_REQUEST_FAILURE: NormalizedFailure = {
  statusCode: HttpStatus.BAD_REQUEST,
  code: defaultCode(HttpStatus.BAD_REQUEST),
  message: defaultMessage(HttpStatus.BAD_REQUEST)
};

/**
 * 업로드 거절은 두 가지 모양으로 이 필터에 도달한다:
 *
 *  1. 원본 `MulterError` — `name === "MulterError"`, `code === "LIMIT_FILE_SIZE"` 등.
 *     HttpException이 아니므로 그대로 두면 아래 non-HttpException 분기를 타
 *     "잠시 후 다시 시도해주세요." 500 봉투로 나간다(사용자 잘못인 요청이
 *     서버 장애처럼 보이고, 서버 로그에도 500 오류로 쌓인다).
 *  2. `@nestjs/platform-express`의 `transformException`이 message 문자열로 분기해
 *     만든 HttpException(413/400). 상태코드는 맞지만 `code` 필드가 없어
 *     `defaultCode`가 413을 모르고 INTERNAL_SERVER_ERROR로 떨어뜨리고, message도
 *     multer의 영문 원문("File too large")이 그대로 노출된다.
 *
 * 두 경우 모두 여기서 413 IMPORT_FILE_TOO_LARGE / 400 일반 검증 오류로 정규화한다.
 * bootstrap.ts에서 body-parser의 413을 4-arg 오류 미들웨어
 * (bodySizeErrorMiddleware)로 잡아내는 것과 대칭인 처리 — 그쪽은 본문 파서가,
 * 이쪽은 multer가 "평범한 Error"를 던지기 때문에 각각의 자리에서 봉투를 맞춰준다.
 */
function normalizedUploadFailure(exception: unknown): NormalizedFailure | null {
  // (1) 원본 MulterError. multer는 apps/api의 직접 의존성이 아니어서(Nest
  //     platform-express의 전이 의존성) import 없이 구조로 식별한다.
  if (exception instanceof Error && exception.name === "MulterError") {
    const code = (exception as Error & { code?: unknown }).code;
    return code === "LIMIT_FILE_SIZE" ? FILE_TOO_LARGE_FAILURE : MULTER_BAD_REQUEST_FAILURE;
  }

  // (2) transformException이 이미 감싼 형태.
  if (exception instanceof HttpException) {
    const body = responseBodyFrom(exception);
    if (typeof body.code === "string") {
      // 우리가 직접 던진 예외(예: fileFilter의 IMPORT_FILE_TYPE_INVALID)는
      // 이미 제대로 된 봉투를 갖고 있으므로 건드리지 않는다.
      return null;
    }
    const message = typeof body.message === "string" ? body.message : "";
    if (exception.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE && message === MULTER_FILE_TOO_LARGE_MESSAGE) {
      return FILE_TOO_LARGE_FAILURE;
    }
    if (exception.getStatus() === HttpStatus.BAD_REQUEST && MULTER_BAD_REQUEST_MESSAGES.has(message)) {
      return MULTER_BAD_REQUEST_FAILURE;
    }
  }

  return null;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<HttpRequest>();
    const response = context.getResponse<HttpResponse>();
    const requestId = requestIdFrom(request);

    // API-130: 업로드(multer) 거절이면 상태코드/코드/문구를 먼저 정규화한다.
    const uploadFailure = normalizedUploadFailure(exception);

    const statusCode =
      uploadFailure?.statusCode ??
      (exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR);

    // SEC-115 F1: a non-HttpException used to be swallowed entirely — the
    // client (correctly) gets only the generic 500 envelope, but nothing
    // reached the server log either, making incidents undiagnosable. Log the
    // cause SERVER-SIDE ONLY, keyed by requestId so it can be correlated with
    // the client-visible envelope. The response body below stays byte-for-byte
    // identical: stacks/messages may contain sensitive values and must never
    // leak into the envelope.
    // API-130: 정규화된 업로드 거절은 "예상된 4xx"이므로 다른 4xx와 마찬가지로
    // 조용히 지나간다 (원본 MulterError라도 500 오류 로그를 남기지 않는다).
    if (!uploadFailure && !(exception instanceof HttpException)) {
      const cause = exception instanceof Error ? exception : undefined;
      this.logger.error(
        `Unhandled exception (requestId=${requestId}): ${cause?.message ?? String(exception)}`,
        cause?.stack
      );
    }
    const exceptionBody = exception instanceof HttpException ? responseBodyFrom(exception) : {};
    const message =
      uploadFailure?.message ??
      (Array.isArray(exceptionBody.message)
        ? "요청 값을 다시 확인해주세요."
        : exceptionBody.message ?? defaultMessage(statusCode));
    const code =
      uploadFailure?.code ??
      exceptionBody.code ??
      (exception instanceof UnauthorizedException
        ? "UNAUTHORIZED"
        : exception instanceof ForbiddenException
          ? "FORBIDDEN"
          : defaultCode(statusCode));

    const extra = Object.fromEntries(
      Object.entries(exceptionBody).filter(([key]) => !KNOWN_ERROR_BODY_KEYS.has(key))
    );

    response.status(statusCode).json({
      error: {
        code,
        message,
        details: exceptionBody.details,
        requestId
      },
      ...extra
    });
  }
}
