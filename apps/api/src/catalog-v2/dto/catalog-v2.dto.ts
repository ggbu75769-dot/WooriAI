import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsEmail,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { catalogScenarioCodes } from "@wooriai/domain";

const PLAN_STATES = [
  "not_considered", "need", "researching", "planned", "ordered", "owned",
  "borrowed", "rented", "gift_expected", "gifted", "not_needed",
  "replacement_needed", "replacement_due", "replaced", "retired", "ended"
] as const;
const ACQUISITION_MODES = ["new_purchase", "secondhand", "rental", "borrow", "gift", "existing", "undecided"] as const;

export class ListCatalogItemsDto {
  @IsOptional() @IsUUID() childId?: string;
  @IsOptional() @IsUUID() motherProfileId?: string;
  @IsOptional() @IsEnum(["mother", "child"] as const) lifecycleAxis?: "mother" | "child";
  @IsOptional() @Matches(/^[a-z][a-z0-9_]{2,59}$/) lifecycleCode?: string;
  @IsOptional() @Matches(/^C\d{2}$/) domainCode?: string;
  @IsOptional() @Matches(/^[a-z][a-z0-9_]{2,59}$/) contextCode?: string;
  @IsOptional() @IsEnum(["required", "recommended", "conditional", "optional"] as const) necessity?: "required" | "recommended" | "conditional" | "optional";
  @IsOptional() @IsEnum(["normal", "elevated", "high"] as const) safetyTier?: "normal" | "elevated" | "high";
  @IsOptional() @IsEnum(["allowed", "inspect", "avoid", "prohibited"] as const) secondhandPolicy?: "allowed" | "inspect" | "avoid" | "prohibited";
  @IsOptional() @IsEnum(["suitable", "conditional", "unsuitable"] as const) rentalPolicy?: "suitable" | "conditional" | "unsuitable";
  @IsOptional() @IsEnum(PLAN_STATES) state?: (typeof PLAN_STATES)[number];
  @IsOptional() @IsString() @MaxLength(80) query?: string;
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 40;
}

export class CatalogItemContextDto {
  @IsOptional() @IsUUID() childId?: string;
  @IsOptional() @IsUUID() motherProfileId?: string;
}

export class UpdatePreparationContextDto {
  @IsArray() @ArrayMaxSize(catalogScenarioCodes.length) @IsEnum(catalogScenarioCodes, { each: true })
  contextCodes!: (typeof catalogScenarioCodes)[number][];
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}

export class CatalogSearchDto extends ListCatalogItemsDto {
  @IsString() @MinLength(1) @MaxLength(80) declare query: string;
}

export class UpdateItemPlanDto {
  @IsEnum(PLAN_STATES) state!: (typeof PLAN_STATES)[number];
  @IsOptional() @IsInt() @Min(0) @Max(999) desiredQuantity?: number;
  @IsOptional() @IsInt() @Min(0) @Max(999) ownedQuantity?: number;
  @IsOptional() @IsInt() @Min(0) @Max(999) quantityNeeded?: number;
  @IsOptional() @IsInt() @Min(0) @Max(999) quantityOwned?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate?: string;
  @IsOptional() @IsEnum(ACQUISITION_MODES) acquisitionMode?: (typeof ACQUISITION_MODES)[number];
  @IsOptional() @IsEnum(ACQUISITION_MODES) acquisitionType?: (typeof ACQUISITION_MODES)[number];
  @IsOptional() @IsUUID() assignedUserId?: string;
  @IsOptional() @IsInt() @Min(0) @Max(2_000_000_000) budgetKrw?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsUUID() linkedExpenseId?: string;
  @IsOptional() @IsString() @MaxLength(80) size?: string;
  @IsOptional() @IsString() @MaxLength(120) variant?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) purchasedAt?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) openedAt?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) expiresAt?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) replacementDueAt?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) usageEndedAt?: string;
  @IsOptional() @IsString() @MaxLength(160) storageLocation?: string;
  @IsOptional() @IsInt() @Min(1) @Max(3650) recurringIntervalDays?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) nextPurchaseDueAt?: string;
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}

export class CreateItemPlanCommentDto {
  @IsString() @Length(1, 1000) body!: string;
  @IsOptional() @IsUUID() clientMutationId?: string;
}

export class BulkItemPlanEntryDto extends UpdateItemPlanDto {
  @IsUUID() itemId!: string;
}

export class BulkItemPlanDto {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => BulkItemPlanEntryDto)
  items!: BulkItemPlanEntryDto[];
}

export class ApplyCatalogBundleItemDto {
  @IsUUID() itemId!: string;
  @IsEnum(PLAN_STATES) state!: (typeof PLAN_STATES)[number];
  @IsOptional() @IsInt() @Min(0) @Max(999) quantityNeeded?: number;
  @IsOptional() @IsUUID() assignedUserId?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate?: string;
  @IsOptional() @IsInt() @Min(0) @Max(2_000_000_000) budgetKrw?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}

export class ApplyCatalogBundleDto {
  @IsBoolean() dryRun!: boolean;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ApplyCatalogBundleItemDto)
  items!: ApplyCatalogBundleItemDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID(undefined, { each: true }) acknowledgeWarningItemIds?: string[];
}

export class CatalogItemReportDto {
  @IsEnum(["missing_item", "wrong_category", "wrong_lifecycle", "inaccurate_description", "safety_concern", "broken_link", "stale_price", "duplicate_item"] as const)
  reasonCode!: string;
  @IsOptional() @IsString() @MaxLength(1000) detail?: string;
}

export class CatalogMissingItemReportDto {
  @IsString() @Length(1, 160) requestedName!: string;
  @IsOptional() @IsString() @MaxLength(1000) detail?: string;
}

export class AcknowledgeCatalogSafetyAlertDto {
  @IsInt() @Min(1) expectedVersion!: number;
}

export class CreateCatalogImportDto {
  @IsString() @Length(1, 200) sourceName!: string;
  @Matches(/^[0-9a-f]{64}$/) sourceHash!: string;
  @IsInt() @Min(0) @Max(1_000_000) rowCount!: number;
}

export class CatalogDraftImportRowDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() nameKo?: string;
  @IsOptional() @IsString() shortDescription?: string;
  @IsOptional() @IsString() reasonText?: string;
  @IsOptional() @IsString() timingSummary?: string;
  @IsOptional() @IsString() sourceSummary?: string;
}

export class PreviewCatalogImportDto {
  @IsString() @Length(1, 200) sourceName!: string;
  @Matches(/^[0-9a-f]{64}$/) sourceHash!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => CatalogDraftImportRowDto)
  rows!: CatalogDraftImportRowDto[];
}

export class ApplyCatalogImportDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsInt({ each: true }) @Min(1, { each: true }) @Max(1_000_000, { each: true })
  rowNumbers!: number[];
}

export class ReconcileCatalogImportsDto {
  @IsBoolean() dryRun!: boolean;
}

export class RepairCatalogImportDto {
  @IsInt() @Min(1) expectedVersion!: number;
}

export class CleanupCatalogImportOrphanDto {
  @IsString() @Matches(/^catalog-imports\/sha256\/[0-9a-f]{64}\.(csv|xlsx)$/) objectKey!: string;
}

export class RollbackCatalogItemDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @Matches(/^[0-9a-f]{64}$/) contentHash!: string;
}

export class CatalogApprovalManifestEntryDto {
  @Matches(/^R4-(?!BUNDLE-)[A-Z0-9-]+$/) itemCode!: string;
  @IsInt() @Min(1) revision!: number;
  @Matches(/^[0-9a-f]{64}$/) contentHash!: string;
  @IsEnum(["editorial", "domain", "safety"] as const) reviewType!: "editorial" | "domain" | "safety";
  @IsEnum(["approved", "changes_requested"] as const) decision!: "approved" | "changes_requested";
  @IsOptional() @IsString() @Length(1, 500) reason?: string;
  @IsOptional() @IsBoolean() professionalReviewConfirmed?: boolean;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) evidenceUrl?: string;
  @IsOptional() @IsString() @MaxLength(240) evidenceTitle?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) reviewExpiresOn?: string;
}

export class PreviewCatalogApprovalManifestDto {
  @IsUUID("4") manifestId!: string;
  @Matches(/^[0-9a-f]{64}$/) sourceHash!: string;
  @IsEmail() reviewerEmail!: string;
  @IsISO8601({ strict: true, strictSeparator: true }) issuedAt!: string;
  @IsISO8601({ strict: true, strictSeparator: true }) expiresAt!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CatalogApprovalManifestEntryDto)
  entries!: CatalogApprovalManifestEntryDto[];
}

export class CreateCatalogNodeDto {
  @Matches(/^C\d{2}(?:-\d{2}){0,2}$/) code!: string;
  @IsEnum(["domain", "category", "subcategory"] as const) level!: "domain" | "category" | "subcategory";
  @IsOptional() @IsUUID() parentId?: string;
  @IsString() @Length(1, 100) nameKo!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) iconKey?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) displayOrder?: number;
}

export class UpdateCatalogNodeDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @Length(1, 100) nameKo?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) iconKey?: string;
}

export class ArchiveCatalogNodeDto {
  @IsInt() @Min(1) expectedVersion!: number;
}

export class CatalogNodeReorderEntryDto {
  @IsUUID() id!: string;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class CatalogNodeReorderDto {
  @IsOptional() @IsUUID() parentId?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => CatalogNodeReorderEntryDto)
  nodes!: CatalogNodeReorderEntryDto[];
}

export class ReviewCatalogItemDto {
  @IsEnum(["editorial", "domain", "safety"] as const) reviewType!: "editorial" | "domain" | "safety";
  @IsInt() @Min(1) expectedVersion!: number;
  @Matches(/^[0-9a-f]{64}$/) contentHash!: string;
  @IsBoolean() professionalReviewConfirmed!: boolean;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) evidenceUrl?: string;
  @IsOptional() @IsString() @MaxLength(240) evidenceTitle?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) reviewExpiresOn?: string;
}

export class RequestCatalogItemReviewDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @Matches(/^[0-9a-f]{64}$/) contentHash!: string;
}

export class PublishCatalogItemDto extends RequestCatalogItemReviewDto {}

export class TransitionCatalogItemDto extends RequestCatalogItemReviewDto {
  @IsEnum(["draft", "editorial_review", "changes_requested", "approved", "scheduled", "suspended", "recalled", "archived"] as const)
  toStatus!: "draft" | "editorial_review" | "changes_requested" | "approved" | "scheduled" | "suspended" | "recalled" | "archived";
  @IsOptional() @IsString() @Length(1, 500) reason?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/) scheduledAt?: string;
}

export class AdminListCatalogItemsDto {
  @IsOptional() @IsString() @MaxLength(80) query?: string;
  @IsOptional() @IsEnum(["draft", "review_requested", "editorial_review", "domain_review", "safety_review", "changes_requested", "approved", "scheduled", "in_review", "published", "suspended", "recalled", "archived", "retired"] as const)
  status?: "draft" | "review_requested" | "editorial_review" | "domain_review" | "safety_review" | "changes_requested" | "approved" | "scheduled" | "in_review" | "published" | "suspended" | "recalled" | "archived" | "retired";
  @IsOptional() @IsEnum(["normal", "elevated", "high"] as const) safetyTier?: "normal" | "elevated" | "high";
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}

export class UpdateCatalogItemDraftDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @Length(1, 120) nameKo?: string;
  @IsOptional() @IsString() @Length(1, 240) shortDescription?: string;
  @IsOptional() @IsEnum(["mother", "child", "caregiver", "household", "shared"] as const) targetSubject?: "mother" | "child" | "caregiver" | "household" | "shared";
  @IsOptional() @IsEnum(["required", "recommended", "conditional", "optional"] as const) necessity?: "required" | "recommended" | "conditional" | "optional";
  @IsOptional() @IsEnum(["recommended", "conditional", "professional_review_required", "not_recommended", "recalled_or_blocked", "retired"] as const) recommendationState?: "recommended" | "conditional" | "professional_review_required" | "not_recommended" | "recalled_or_blocked" | "retired";
  @IsOptional() @IsString() @Length(1, 5000) reasonText?: string;
  @IsOptional() @IsString() @MaxLength(5000) skipReasonText?: string;
  @IsOptional() @IsString() @MaxLength(240) quantityGuidance?: string;
  @IsOptional() @IsString() @Length(1, 240) timingSummary?: string;
  @IsOptional() @IsEnum(["allowed", "inspect", "avoid", "prohibited"] as const) secondhandPolicy?: "allowed" | "inspect" | "avoid" | "prohibited";
  @IsOptional() @IsEnum(["suitable", "conditional", "unsuitable"] as const) rentalPolicy?: "suitable" | "conditional" | "unsuitable";
  @IsOptional() @IsEnum(["normal", "elevated", "high"] as const) safetyTier?: "normal" | "elevated" | "high";
  @IsOptional() @IsString() @MaxLength(5000) safetyNote?: string;
  @IsOptional() @IsBoolean() medicalDisclaimerRequired?: boolean;
  @IsOptional() @IsString() @Length(1, 5000) sourceSummary?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) displayOrder?: number;
}

export class ReplaceCatalogAliasesDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsString({ each: true })
  aliases!: string[];
}

export class CatalogLifecycleRuleInputDto {
  @IsEnum(["mother", "child"] as const) axis!: "mother" | "child";
  @Matches(/^[a-z][a-z0-9_]{2,59}$/) lifecycleCode!: string;
  @IsOptional() @IsString() @MaxLength(240) timingText?: string;
  @IsOptional() @IsInt() @Min(-1000) @Max(1000) priorityWeight?: number;
}

export class ReplaceCatalogMappingsDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @Matches(/^C\d{2}(?:-[A-Z0-9]+){2}$/) primaryCategoryCode!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @Matches(/^C\d{2}(?:-[A-Z0-9]+){0,2}$/, { each: true }) additionalCategoryCodes?: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => CatalogLifecycleRuleInputDto)
  lifecycles!: CatalogLifecycleRuleInputDto[];
  @IsArray() @ArrayMaxSize(30) @Matches(/^[a-z][a-z0-9_]{2,59}$/, { each: true }) contextCodes!: string[];
}

export class CreateProductOfferDto {
  @IsString() @Length(1, 120) seller!: string;
  @IsOptional() @IsString() @MaxLength(120) brand?: string;
  @IsString() @Length(1, 200) productName!: string;
  @IsOptional() @IsString() @MaxLength(160) modelName?: string;
  @IsUrl({ protocols: ["https"], require_protocol: true }) publicUrl!: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) affiliateUrl?: string;
  @IsOptional() @IsBoolean() isAffiliate?: boolean;
  @IsOptional() @IsBoolean() isSponsored?: boolean;
  @IsOptional() @IsString() @MaxLength(240) disclosureText?: string;
  @IsOptional() @IsInt() @Min(0) @Max(2_000_000_000) priceSnapshotKrw?: number;
  @IsOptional() @IsISO8601({ strict: true, strictSeparator: true }) priceCheckedAt?: string;
  @IsOptional() @IsObject() comparisonAttributes?: Record<string, string | number | boolean>;
}

export class ApproveProductOfferDto {
  @IsISO8601({ strict: true, strictSeparator: true }) expectedUpdatedAt!: string;
}

export class BlockProductOfferDto {
  @IsEnum(["blocked", "recalled"] as const) reason!: "blocked" | "recalled";
}

export class ResolveCatalogItemReportDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class ResolveCatalogItemReportsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID("4", { each: true }) reportIds!: string[];
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
