import {
  BadRequestException,
  type Type,
  type INestApplication,
  type ValidationError,
  ValidationPipe
} from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { requestIdMiddleware } from "./common/logging/request-id.middleware";
import { requestLoggerMiddleware } from "./common/logging/request-logger.middleware";
import { metricsMiddleware } from "./metrics/metrics.middleware";
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
          code: "VALIDATION_ERROR",
          message: "요청 값을 다시 확인해주세요.",
          details: validationDetails(errors)
        })
    });
}

export function configureApiApp(app: INestApplication) {
  // Assign/propagate x-request-id first so it's available even for requests
  // that fail during body parsing, before anything else runs.
  app.use(requestIdMiddleware());

  // Rate limiting and security headers run before body parsing so a rejected
  // (429) request never pays the 1MB parse cost, and even 413/429 responses
  // carry the security headers and appear in the request log.
  app.use(securityHeadersMiddleware());
  app.use(requestLoggerMiddleware());
  app.use(metricsMiddleware());
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

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(createDtoValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
}
