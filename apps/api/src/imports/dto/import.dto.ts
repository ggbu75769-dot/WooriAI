import { Allow, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

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

  @IsOptional()
  @IsInt()
  @Min(1)
  parsedAmountKrw?: number;
}

export class ConfirmImportDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  selectedRowIds!: string[];
}
