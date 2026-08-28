import { Allow, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { MONEY_KRW_MAX } from "@wooriai/contracts";

export class CreateExcelImportDto {
  // SEC-115 F2: fileName is persisted verbatim into import_jobs.fileName —
  // without a length cap an attacker-controlled multipart/JSON field could
  // store arbitrarily large strings. 255 matches a typical filesystem
  // filename limit and is far above any real picked-file name.
  @IsOptional()
  @IsString()
  @MaxLength(255)
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
