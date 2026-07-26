import type { Prisma } from "@prisma/client";

export const ITEM_EVIDENCE_STATUS = {
  draft: "draft",
  valid: "valid",
  rejected: "rejected"
} as const;

export const SAFETY_EVIDENCE_SOURCE_TYPES = [
  "official",
  "official_guidance",
  "professional_review"
] as const;

export function safetyAlternativeClaim(alternativeItemDefinitionId: string) {
  return `safety_alternative:${alternativeItemDefinitionId}`;
}

export function evidenceHasClaim(value: Prisma.JsonValue | null, claim: string) {
  return Array.isArray(value) && value.some((entry) => entry === claim);
}

export function evidenceHasIndependentCaptureAndReview(input: {
  capturedByAdminId: string | null;
  reviewedByAdminId: string | null;
}) {
  return Boolean(
    input.capturedByAdminId &&
    input.reviewedByAdminId &&
    input.capturedByAdminId !== input.reviewedByAdminId
  );
}

export function safetyApprovalHasIndependentActors(
  evidence: {
    capturedByAdminId: string | null;
    reviewedByAdminId: string | null;
  },
  approvedByAdminId: string | null
) {
  return Boolean(
    evidenceHasIndependentCaptureAndReview(evidence) &&
    approvedByAdminId &&
    approvedByAdminId !== evidence.capturedByAdminId &&
    approvedByAdminId !== evidence.reviewedByAdminId
  );
}

export function currentReviewedEvidenceWhere(
  now: Date,
  options: { safetySourcesOnly?: boolean } = {}
): Prisma.ItemEvidenceSourceWhereInput {
  return {
    status: ITEM_EVIDENCE_STATUS.valid,
    capturedByAdminId: { not: null },
    reviewedByAdminId: { not: null },
    ...(options.safetySourcesOnly ? { sourceType: { in: [...SAFETY_EVIDENCE_SOURCE_TYPES] } } : {}),
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { OR: [{ reviewDueAt: null }, { reviewDueAt: { gt: now } }] }
    ]
  };
}
