import {
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
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
import { ConfirmImportDto, UpdateImportRowDto } from "./dto/import.dto";

type UploadedImportFile = {
  originalname?: string;
  size?: number;
};

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
  constructor(@Inject(OnboardingStoreService) private readonly store: OnboardingStoreService) {}

  @Post("children/:childId/imports/excel")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  async createExcelImport(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @UploadedFile() file: UploadedImportFile | undefined,
    @Body() body: Record<string, unknown>
  ) {
    return await this.store.createImportJob(request.user!, childId, {
      fileName: stringField(body.fileName) ?? file?.originalname,
      fileSizeBytes: file?.size ?? numberField(body.fileSizeBytes),
      estimatedRowCount: numberField(body.estimatedRowCount)
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
  async confirmImport(
    @Req() request: AuthenticatedRequest,
    @Param("importJobId") importJobId: string,
    @Body(createDtoValidationPipe(ConfirmImportDto)) body: ConfirmImportDto
  ) {
    return await this.store.confirmImport(request.user!, importJobId, body);
  }
}
