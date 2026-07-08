import {
  BadRequestException,
  type Type,
  type INestApplication,
  type ValidationError,
  ValidationPipe
} from "@nestjs/common";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

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
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(createDtoValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
}
