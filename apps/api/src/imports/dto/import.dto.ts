import { Allow, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { MONEY_KRW_MAX } from "@wooriai/contracts";

/**
 * `import_jobs.file_name varchar(255)`와 동치(prisma/schema.prisma의 `ImportJob.fileName`).
 *
 * 라운드 110 두 시점 — 종전(그때는 참): SEC-115 F2가 세운 이 상한은 **이 파일의 리터럴
 * `@MaxLength(255)` 하나**였고, 그것으로 충분했다(그때 아는 유입 지점이 본문 필드뿐이었다).
 * → 이제 같은 컬럼에 쓰는 유입 지점이 **둘**이라는 것이 실측으로 드러났다: 컨트롤러가
 * `stringField(body.fileName) ?? file?.originalname`로 고르므로(imports.controller.ts),
 * `fileName` 필드를 **보내지 않은** 멀티파트 요청은 이 DTO를 지나지 않고 파일 파트의
 * 이름이 그대로 컬럼으로 간다. 그래서 숫자를 이름 있는 상수로 올리고 두 번째 유입 지점
 * (`ImportPipelineService.requireAcceptedImportFile`)이 같은 값을 읽게 한다 —
 * `households/custom-categories.service.ts`가 `customCategoryNameMaxLength()`를 읽는 관례 그대로다.
 */
const IMPORT_FILE_NAME_MAX_LENGTH = 255;

/** 위 상수의 읽기 창구(라운드 95 공통 금지 — 앱 소스에 새 `export const`를 두지 않는다). */
export function importFileNameMaxLength(): number {
  return IMPORT_FILE_NAME_MAX_LENGTH;
}

export class CreateExcelImportDto {
  // SEC-115 F2: fileName is persisted verbatim into import_jobs.fileName —
  // without a length cap an attacker-controlled multipart/JSON field could
  // store arbitrarily large strings. 255 matches a typical filesystem
  // filename limit and is far above any real picked-file name.
  @IsOptional()
  @IsString()
  @MaxLength(IMPORT_FILE_NAME_MAX_LENGTH)
  fileName?: string;

  // Sent by some clients alongside (or instead of) the multipart file part.
  // Multipart text fields arrive as strings while JSON bodies carry numbers,
  // so the controller's numberField() keeps doing the coercion — these are
  // whitelisted here (not typed) purely so forbidNonWhitelisted doesn't
  // reject them.
  @Allow()
  fileSizeBytes?: unknown;

  @Allow()
  estimatedRowCount?: unknown;
}

export class UpdateImportRowDto {
  @IsOptional()
  @IsBoolean()
  selected?: boolean;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  parsedItemName?: string;

  /**
   * GAP-054 라운드 54 P1-1: `import_rows.parsed_amount_krw`는 int4다. 상한을 걸지 않으면
   * 검수 화면에서 고친 금액이 검증이 아니라 **DB에서** 터져 500으로 나간다(지출·예산 DTO가
   * 같은 이유로 이미 `@Max(MONEY_KRW_MAX)`를 물고 있다).
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MONEY_KRW_MAX)
  parsedAmountKrw?: number;
}

export class ConfirmImportDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  selectedRowIds!: string[];
}
