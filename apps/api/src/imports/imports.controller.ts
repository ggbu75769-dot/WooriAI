import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { IMPORT_MAX_FILE_SIZE_BYTES, ImportPipelineService } from "../onboarding/import-pipeline.service";
import { ConfirmImportDto, CreateExcelImportDto, UpdateImportRowDto } from "./dto/import.dto";

type UploadedImportFile = {
  originalname?: string;
  size?: number;
  buffer?: Buffer;
};

/**
 * API-130: 업로드 mimetype 1차 관문.
 *
 * 클라이언트가 보내는 mimetype은 신뢰할 수 없다 — 안드로이드/윈도우는 같은 csv를
 * text/plain·application/vnd.ms-excel·application/octet-stream 등으로 제각각
 * 보고하고, 모바일 앱(client.ts)은 값이 없으면 application/octet-stream으로
 * 채운다. 그래서 이 화이트리스트는 **명백한 불일치(이미지/PDF/영상 등)만**
 * 거르도록 넉넉하게 잡고, 실제 형식 판정은 ImportPipelineService가 부르는
 * `assertImportFileMatchesExtension`의 매직바이트 검사가 맡는다.
 */
const ACCEPTED_IMPORT_MIME_TYPES = new Set([
  // csv (OS/브라우저별 표기 편차)
  "text/csv",
  "text/plain",
  "text/comma-separated-values",
  "text/x-comma-separated-values",
  "text/x-csv",
  "application/csv",
  "application/x-csv",
  "application/vnd.ms-excel", // 윈도우가 .csv를 이렇게 보고하는 경우가 흔하다
  // xlsx (OOXML = zip 컨테이너라 zip 계열로 보고되기도 한다)
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
  // 판단 불가 — 매직바이트 검사에 맡긴다
  "application/octet-stream",
  ""
]);

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberField(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class ImportsController {
  constructor(@Inject(ImportPipelineService) private readonly store: ImportPipelineService) {}

  @Post("children/:childId/imports/excel")
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor("file", {
      // 상한 초과는 multer가 스트림을 끊고 LIMIT_FILE_SIZE로 거절한다 →
      // GlobalExceptionFilter가 413 IMPORT_FILE_TOO_LARGE로 정규화(API-130).
      limits: { fileSize: IMPORT_MAX_FILE_SIZE_BYTES },
      fileFilter(_request, file, callback) {
        const mimetype = (file.mimetype ?? "").split(";")[0].trim().toLowerCase();
        if (ACCEPTED_IMPORT_MIME_TYPES.has(mimetype)) {
          callback(null, true);
          return;
        }
        // HttpException을 그대로 넘기면 Nest의 transformException이 손대지 않고
        // 통과시켜, 확장자 화이트리스트와 같은 400 봉투로 나간다.
        callback(
          new BadRequestException({
            code: "IMPORT_FILE_TYPE_INVALID",
            message: "Only csv or xlsx files are allowed."
          }),
          false
        );
      }
    })
  )
  async createExcelImport(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @UploadedFile() file: UploadedImportFile | undefined,
    @Body(createDtoValidationPipe(CreateExcelImportDto)) body: CreateExcelImportDto
  ) {
    return await this.store.createImportJob(request.user!, childId, {
      fileName: stringField(body.fileName) ?? file?.originalname,
      fileSizeBytes: file?.size ?? numberField(body.fileSizeBytes),
      estimatedRowCount: numberField(body.estimatedRowCount),
      fileBuffer: file?.buffer
    });
  }

  @Get("imports/:importJobId")
  async getImportJob(@Req() request: AuthenticatedRequest, @Param("importJobId") importJobId: string) {
    return await this.store.getImportJob(request.user!, importJobId);
  }

  @Get("imports/:importJobId/rows")
  async listImportRows(@Req() request: AuthenticatedRequest, @Param("importJobId") importJobId: string) {
    return await this.store.listImportRows(request.user!, importJobId);
  }

  @Patch("imports/:importJobId/rows/:rowId")
  async updateImportRow(
    @Req() request: AuthenticatedRequest,
    @Param("importJobId") importJobId: string,
    @Param("rowId") rowId: string,
    @Body(createDtoValidationPipe(UpdateImportRowDto)) body: UpdateImportRowDto
  ) {
    return await this.store.updateImportRow(request.user!, importJobId, rowId, body);
  }

  @Post("imports/:importJobId/confirm")
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async confirmImport(
    @Req() request: AuthenticatedRequest,
    @Param("importJobId") importJobId: string,
    @Body(createDtoValidationPipe(ConfirmImportDto)) body: ConfirmImportDto
  ) {
    return await this.store.confirmImport(request.user!, importJobId, body);
  }
}
