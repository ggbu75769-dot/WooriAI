import {
  BadRequestException,
  Logger,
  type Type,
  type INestApplication,
  type ValidationError,
  ValidationPipe
} from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  EXPENSE_AMOUNT_TOO_LARGE_CODE,
  GlobalExceptionFilter
} from "./common/filters/global-exception.filter";
import { requestIdMiddleware } from "./common/logging/request-id.middleware";
import { requestLoggerMiddleware } from "./common/logging/request-logger.middleware";
import { bodySizeErrorMiddleware } from "./common/security/body-size-error.middleware";
import { rateLimitMiddleware } from "./common/security/rate-limit.middleware";
import { securityHeadersMiddleware } from "./common/security/security-headers.middleware";

const BODY_SIZE_LIMIT = "1mb";

function validationDetails(errors: ValidationError[]) {
  return {
    fields: errors.map((error) => ({
      field: error.property,
      constraints: error.constraints ?? {}
    }))
  };
}

/**
 * GAP-054 라운드 54 P2-6 — 금액 상한(`@Max(MONEY_KRW_MAX)`) 위반인가.
 *
 * `class-validator`의 `Max`는 제약 키를 `max`로 남긴다. 금액 필드의 그 제약 하나만 골라 전용
 * 코드로 승격하고, 나머지 검증 실패는 한 글자도 바뀌지 않는다. 대상 필드는 두 이름이다 —
 * 지출·예산의 `amountKrw`와 가져오기 검수 행의 `parsedAmountKrw`(둘 다 int4 컬럼이라 같은
 * 상한을 문다). 중첩 DTO는 이 API에 없지만, 있어도 안전하도록 children까지 훑는다.
 */
const AMOUNT_LIMITED_FIELDS = new Set(["amountKrw", "parsedAmountKrw"]);

function hasAmountTooLargeViolation(errors: ValidationError[]): boolean {
  return errors.some(
    (error) =>
      (AMOUNT_LIMITED_FIELDS.has(error.property) && Boolean(error.constraints?.max)) ||
      hasAmountTooLargeViolation(error.children ?? [])
  );
}

export function createDtoValidationPipe(expectedType?: Type<unknown>) {
  return new ValidationPipe({
      forbidNonWhitelisted: true,
      expectedType,
      transform: true,
      validationError: {
        target: false,
        value: false
      },
      whitelist: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          // P2-6: 금액 상한 위반만 전용 코드로 갈린다. 상태코드·문구·details는 종전 그대로다
          // (근거는 global-exception.filter.ts의 EXPENSE_AMOUNT_TOO_LARGE_CODE 주석).
          code: hasAmountTooLargeViolation(errors) ? EXPENSE_AMOUNT_TOO_LARGE_CODE : "VALIDATION_ERROR",
          message: "요청 값을 다시 확인해주세요.",
          details: validationDetails(errors)
        })
    });
}

export function configureApiApp(app: INestApplication) {
  // TRUST_PROXY=1 (or "true"): the API sits exactly one reverse-proxy hop
  // behind Caddy (Oracle compose) / Fly's edge proxy, so Express must derive
  // req.ip from X-Forwarded-For (one hop) or every request would share the
  // proxy's IP — collapsing the per-IP rate limiter (rate-limit.middleware.ts)
  // into a single global bucket any one client can exhaust. Default OFF:
  // directly-exposed deployments must keep ignoring the spoofable header.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy === "1" || trustProxy === "true") {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  } else if (trustProxy !== undefined && trustProxy !== "" && trustProxy !== "0") {
    // Any other value ("2", "yes", "on", …) is a likely misconfiguration:
    // the operator intended to enable trust proxy but it stays OFF, which
    // silently collapses the rate limiter into one shared bucket behind a
    // proxy. Warn loudly; explicit off ("0"/empty/unset) stays silent.
    new Logger("configureApiApp").warn(
      `TRUST_PROXY="${trustProxy}" is not a recognized value — only "1" or "true" enable it; trust proxy stays OFF (X-Forwarded-For ignored)`
    );
  }

  // Assign/propagate x-request-id first so it's available even for requests
  // that fail during body parsing, before anything else runs.
  app.use(requestIdMiddleware());

  // Rate limiting and security headers run before body parsing so a rejected
  // (429) request never pays the 1MB parse cost, and even 413/429 responses
  // carry the security headers and appear in the request log.
  app.use(securityHeadersMiddleware());
  app.use(requestLoggerMiddleware());
  app.use(rateLimitMiddleware());

  // Runs before Nest's own default body-parser registration (which happens
  // inside app.init()/app.listen(), i.e. after this synchronous call
  // returns) and takes over json/urlencoded parsing at a 1MB limit -- Nest's
  // subsequent default registration then no-ops since the body is already
  // parsed. Multipart uploads (import excel) go through FileInterceptor's
  // own multer config (10MB), unaffected by this.
  const expressApp = app as unknown as NestExpressApplication;
  expressApp.useBodyParser("json", { limit: BODY_SIZE_LIMIT });
  expressApp.useBodyParser("urlencoded", { limit: BODY_SIZE_LIMIT, extended: true });
  // Body-parser's size-limit rejection is a plain Error, not a NestJS
  // HttpException -- without this 4-arg error middleware right after the
  // parsers, it would fall through to GlobalExceptionFilter's generic
  // non-HttpException branch and come back as a misleading 500 instead of a
  // 413.
  app.use(bodySizeErrorMiddleware());

  // The public invite landing page (households/invite-landing.controller.ts)
  // must live at the exact path production invite links carry
  // (`${INVITE_LINK_BASE_URL}/invite/${token}`), i.e. WITHOUT the api/v1
  // prefix. Everything else keeps the prefix, including the JSON invite API
  // at /api/v1/invites/:token (plural -- a different route).
  app.setGlobalPrefix("api/v1", { exclude: ["invite/:token"] });
  app.useGlobalPipes(createDtoValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
}
