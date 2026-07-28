import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export class LegalDocumentCandidateDto {
  @IsIn(["terms", "privacy", "marketing", "analytics"])
  documentType!: "terms" | "privacy" | "marketing" | "analytics";

  @IsOptional() @IsString() @MaxLength(20)
  locale?: string;

  @IsString() @MinLength(1) @MaxLength(30)
  version!: string;

  @IsString() @MinLength(1) @MaxLength(160)
  title!: string;

  @IsString() @MaxLength(200_000)
  bodyMarkdown!: string;

  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true })
  publicUrl?: string;

  @IsBoolean()
  required!: boolean;

  @IsISO8601()
  effectiveAt!: string;
}

export class ApproveLegalDocumentDto {
  @IsInt() @Min(1)
  expectedRevision!: number;

  @IsString() @MinLength(3) @MaxLength(500)
  approvalNote!: string;
}

export class PublishLegalDocumentDto {
  @IsInt() @Min(1)
  expectedRevision!: number;
}

export class CreateEvidenceSourceDto {
  @IsString() @MinLength(1) @MaxLength(40)
  sourceType!: string;

  @IsString() @MinLength(1) @MaxLength(240)
  title!: string;

  @IsUrl({ protocols: ["https"], require_protocol: true })
  publicUrl!: string;

  @IsOptional() @IsString() @MaxLength(160)
  publisher?: string;

  @IsOptional() @IsISO8601()
  publishedAt?: string;

  @IsInt() @Min(1)
  revision!: number;

  @IsArray() @ArrayMaxSize(100) @IsString({ each: true })
  applicableClaims!: string[];

  @IsOptional() @IsISO8601()
  expiresAt?: string;

  @IsOptional() @IsISO8601()
  reviewDueAt?: string;
}

export class ReviewEvidenceSourceDto {
  @Matches(/^[0-9a-f]{64}$/)
  expectedContentHash!: string;

  @IsBoolean()
  approved!: boolean;
}

export class PreviewPilotManifestDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsUUID("4", { each: true })
  itemIds!: string[];
}

export class PublishPilotManifestDto {
  @Matches(/^[0-9a-f]{64}$/)
  expectedContentHash!: string;
}
