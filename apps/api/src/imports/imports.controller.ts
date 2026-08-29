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
import { AuditLoggerService } from "../common/audit/audit-logger.service";
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
  "application/x-msexcel", // R30 리뷰 F9: 구형 윈도우/한국 환경 변형 표기
  "application/excel",
  // xlsx (OOXML = zip 컨테이너라 zip 계열로 보고되기도 한다)
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/haansoftxlsx", // 한컴오피스가 xlsx를 이렇게 보고한다
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
  constructor(
    @Inject(ImportPipelineService) private readonly store: ImportPipelineService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

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

  /**
   * GAP-064 #9: 확정(승인)을 감사 로그에 남긴다.
   *
   * DNC-012는 이 앱의 돈 데이터 신뢰 계약이다 — "미리보기와 **승인** 전 `expenses`에 저장하지
   * 않는다". 그런데 그 계약의 핵심 사건인 승인만 서버에 흔적이 없었다(지출 수정·삭제, 아이 삭제,
   * 가구 탈퇴·계정 삭제, 예산 덮어쓰기는 모두 기록된다). 확정은 되돌릴 수 없고
   * (`preview_ready`만 확정 가능 — import-pipeline.service.ts의 CAS) 가구의 **아무 쓰기 권한자나**
   * 실행할 수 있어서, "카드 내역을 가져왔는데 일부가 안 들어왔어요" CS에 답하려면 누가·언제·
   * 몇 건을 승인했는지가 필요하다. 잡 행의 `approved_at`은 시각만 답하고 행위자는 답하지 않는다.
   *
   * 봉투는 budget.upsert·expense.update와 같은 모양이고(actor·household·target + before/after),
   * 그 이상은 싣지 않는다: **상태·건수·시각뿐**이다. **파일명·행 원문은 금지** — 파일명은
   * 사용자가 붙인 이름이라 사실상 식별정보이고(GAP-063 #6), 파기 잡 phase 11이 90일 뒤
   * 마스킹하는 값이라 730일 보존되는 감사 로그에 복사하면 그 마스킹이 무의미해진다.
   * `before.rowCount`/`candidateCount`와 `after.importedCount`/`skippedCount`가 "몇 줄짜리
   * 파일에서 몇 건이 들어갔나"라는 CS 질문에 답하는 값이고, 어느 것도 개인을 가리키지 않는다.
   *
   * 기록 실패는 AuditLoggerService가 삼키므로 가져오기 응답에는 영향이 없고, 멱등 재전송은
   * 위 IdempotencyInterceptor가 캐시 응답으로 끊어 중복 기록되지 않는다. 볼륨은 지출보다 훨씬
   * 낮다(가져오기는 드물다) — 마이그레이션 0건의 additive 경로다.
   */
  @Post("imports/:importJobId/confirm")
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async confirmImport(
    @Req() request: AuthenticatedRequest,
    @Param("importJobId") importJobId: string,
    @Body(createDtoValidationPipe(ConfirmImportDto)) body: ConfirmImportDto
  ) {
    // `audit`는 응답 계약이 아니다 — 여기서 벗겨 내고 나머지(importedCount·skippedCount)만
    // 그대로 내보낸다(응답 모양 무변경).
    const { audit, ...response } = await this.store.confirmImport(request.user!, importJobId, body);
    await this.auditLogger.record({
      actorUserId: request.user!.id,
      householdId: audit.householdId,
      action: "import.confirm",
      targetType: "import_job",
      targetId: importJobId,
      before: audit.before,
      after: audit.after
    });
    return response;
  }

  /**
   * GAP-067 #3 — 확정한 가져오기 되돌리기.
   *
   * 라운드 66 #5가 `expenses.import_job_id`를 채우면서 서버는 "이 파일에서 온 200건"을 알게
   * 됐는데, 사용자가 그것을 되돌릴 길은 없었다(앱의 수단은 한 건씩 롱프레스 삭제뿐이고, 어느
   * 200건인지 화면에서 가릴 방법도 없다). 이 경로가 그 나머지 절반이다.
   *
   * 감사 로그는 **묶음 1행**(`import.undo`)이다 — 200줄이면 CS 화면을 덮고, 그 200줄이 답하는
   * "어느 행이 지워졌나"는 `import_job_id`가 이미 답한다(라운드 66이 그 칸을 채운 이유). 봉투는
   * `import.confirm`과 같은 모양이고 같은 금지를 진다: **파일명·행 원문 금지**, 상태·건수·시각뿐.
   * 그래서 한 잡의 이력은 `import.confirm` → `import.undo` 두 줄로 순서까지 읽힌다.
   *
   * `IdempotencyInterceptor`를 달지 않는 이유: 되돌리기는 **경로 자체가 멱등**이다(살아 있는
   * 행만 지우므로 두 번째 호출은 0건이고 상태도 그대로다). 확정처럼 캐시 응답으로 끊을 필요가
   * 없고, 끊으면 오히려 "그 사이 손으로 지운 행"까지 반영된 진짜 건수 대신 옛 숫자가 돌아온다.
   *
   * `audit`는 응답 계약이 아니다 — 여기서 벗겨 내고 `deletedCount`만 내보낸다.
   */
  @Post("imports/:importJobId/undo")
  @HttpCode(200)
  async undoImport(@Req() request: AuthenticatedRequest, @Param("importJobId") importJobId: string) {
    const { audit, ...response } = await this.store.undoImport(request.user!, importJobId);
    await this.auditLogger.record({
      actorUserId: request.user!.id,
      householdId: audit.householdId,
      action: "import.undo",
      targetType: "import_job",
      targetId: importJobId,
      before: audit.before,
      after: audit.after
    });
    return response;
  }
}
