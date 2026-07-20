import { Controller, Get, Inject, Query, Req, Res, UseGuards } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Response } from "express";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ReportRangeQueryDto, ReportSourcesQueryDto, ReportTrendQueryDto } from "./dto/reports-v2.dto";
import { ReportsV2Service } from "./reports-v2.service";

function setReportEtag(response: Response, value: unknown) {
  response.setHeader("ETag", `"${createHash("sha256").update(JSON.stringify(value)).digest("base64url")}"`);
  response.setHeader("Cache-Control", "private, max-age=30");
}

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsV2Controller {
  constructor(@Inject(ReportsV2Service) private readonly reports: ReportsV2Service) {}

  private async response(response: Response, work: Promise<unknown>) {
    const result = await work;
    setReportEtag(response, result);
    return result;
  }

  @Get("summary")
  summary(@Req() request: AuthenticatedRequest, @Query(createDtoValidationPipe(ReportRangeQueryDto)) query: ReportRangeQueryDto, @Res({ passthrough: true }) response: Response) {
    return this.response(response, this.reports.summary(request.user!, query));
  }

  @Get("categories")
  categories(@Req() request: AuthenticatedRequest, @Query(createDtoValidationPipe(ReportRangeQueryDto)) query: ReportRangeQueryDto, @Res({ passthrough: true }) response: Response) {
    return this.response(response, this.reports.categories(request.user!, query));
  }

  @Get("trend")
  trend(@Req() request: AuthenticatedRequest, @Query(createDtoValidationPipe(ReportTrendQueryDto)) query: ReportTrendQueryDto, @Res({ passthrough: true }) response: Response) {
    return this.response(response, this.reports.trend(request.user!, query, query.unit));
  }

  @Get("members")
  members(@Req() request: AuthenticatedRequest, @Query(createDtoValidationPipe(ReportRangeQueryDto)) query: ReportRangeQueryDto, @Res({ passthrough: true }) response: Response) {
    return this.response(response, this.reports.members(request.user!, query));
  }

  @Get("preparation")
  preparation(@Req() request: AuthenticatedRequest, @Query(createDtoValidationPipe(ReportRangeQueryDto)) query: ReportRangeQueryDto, @Res({ passthrough: true }) response: Response) {
    return this.response(response, this.reports.preparation(request.user!, query));
  }

  @Get("recurring")
  recurring(@Req() request: AuthenticatedRequest, @Query(createDtoValidationPipe(ReportRangeQueryDto)) query: ReportRangeQueryDto, @Res({ passthrough: true }) response: Response) {
    return this.response(response, this.reports.recurring(request.user!, query));
  }

  @Get("v3")
  v3(@Req() request: AuthenticatedRequest, @Query(createDtoValidationPipe(ReportRangeQueryDto)) query: ReportRangeQueryDto, @Res({ passthrough: true }) response: Response) {
    return this.response(response, this.reports.v3(request.user!, query));
  }

  @Get("v3/sources")
  sources(@Req() request: AuthenticatedRequest, @Query(createDtoValidationPipe(ReportSourcesQueryDto)) query: ReportSourcesQueryDto, @Res({ passthrough: true }) response: Response) {
    return this.response(response, this.reports.sources(request.user!, query));
  }

  @Get("variance-explanation")
  varianceExplanation(@Req() request: AuthenticatedRequest, @Query(createDtoValidationPipe(ReportRangeQueryDto)) query: ReportRangeQueryDto, @Res({ passthrough: true }) response: Response) {
    return this.response(response, this.reports.varianceExplanation(request.user!, query));
  }
}
