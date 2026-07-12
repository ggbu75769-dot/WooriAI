import { randomUUID } from "node:crypto";
import {
  ArgumentsHost,
  Catch,
  ForbiddenException,
  HttpException,
  HttpStatus,
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

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<HttpRequest>();
    const response = context.getResponse<HttpResponse>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = exception instanceof HttpException ? responseBodyFrom(exception) : {};
    const message = Array.isArray(exceptionBody.message)
      ? "요청 값을 다시 확인해주세요."
      : exceptionBody.message ?? defaultMessage(statusCode);
    const code =
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
        requestId: requestIdFrom(request)
      },
      ...extra
    });
  }
}
