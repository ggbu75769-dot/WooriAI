import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf
} from "class-validator";

// COM-103: CMS draft -> review -> publish workflow (round5a-sprint2-plan.md §3).
// entityType enumerates the live tables a content revision can target; payload
// validation per entityType reuses the existing admin create DTOs (see
// content-revisions.service.ts#validatePayload) plus AdminContentRevisionDisclosurePayloadDto
// below for the one entity type (disclosure) that has no dedicated "full snapshot"
// DTO today (UpdateDisclosureDto only carries `text`, keyed by a path param).
export const CONTENT_REVISION_ENTITY_TYPES = ["item_template", "product_link", "disclosure"] as const;
export type ContentRevisionEntityType = (typeof CONTENT_REVISION_ENTITY_TYPES)[number];

// "publishing" (M-2, round5a-sprint2-plan.md §3 diff-review follow-up) is a
// short-lived internal state a revision passes through between the
// in_review -> published CAS claim and the (slower, cross-service) live
// write actually completing -- not reachable via any request body, but valid
// as a status filter value and visible if GET is polled mid-flight.
export const CONTENT_REVISION_STATUSES = [
  "draft",
  "in_review",
  "publishing",
  "published",
  "rejected",
  "archived"
] as const;
export type ContentRevisionStatus = (typeof CONTENT_REVISION_STATUSES)[number];

export class CreateContentRevisionDto {
  @IsIn(CONTENT_REVISION_ENTITY_TYPES)
  entityType!: ContentRevisionEntityType;

  // Omitted/undefined = draft for a brand-new entity (created on publish).
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsObject()
  @IsNotEmptyObject()
  payload!: Record<string, unknown>;
}

export class UpdateContentRevisionDto {
  @IsObject()
  @IsNotEmptyObject()
  payload!: Record<string, unknown>;
}

/**
 * COM-103b: PATCH /admin/content-revisions/:id/schedule body. `scheduledFor`
 * is required but nullable — an ISO-8601 timestamp sets the schedule, an
 * explicit `null` clears it. ValidateIf skips IsISO8601 only for the literal
 * null, so an omitted/undefined field still fails validation (400) instead of
 * silently clearing the schedule.
 */
export class ScheduleContentRevisionDto {
  @ValidateIf((dto: ScheduleContentRevisionDto) => dto.scheduledFor !== null)
  @IsISO8601()
  scheduledFor!: string | null;
}

export class RejectContentRevisionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note!: string;
}

/**
 * Self-contained payload shape for disclosure revisions. Disclosures are
 * upserted by `key` (see ItemsCatalogService#adminUpdateDisclosure), not by
 * id, so unlike item_template/product_link the revision payload must carry the
 * key itself to remain a complete, replayable snapshot (needed for rollback and
 * for drafting a brand-new disclosure key that doesn't exist live yet).
 */
export class AdminContentRevisionDisclosurePayloadDto {
  @IsString()
  @MaxLength(80)
  key!: string;

  @IsString()
  text!: string;
}
