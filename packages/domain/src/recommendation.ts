import type { ItemStatus, NecessityLevel } from "./enums";

const NECESSITY_SCORE: Record<NecessityLevel, number> = {
  essential: 30,
  convenience: 20,
  optional: 10
};

const STATUS_SCORE: Record<ItemStatus, number> = {
  not_prepared: 20,
  interested: 15,
  prepared: 0,
  gifted: 0,
  not_needed: 0
};

const EXCLUDED_NOW_NEEDED_STATUSES = new Set<ItemStatus>(["prepared", "gifted", "not_needed"]);

export type RecommendationScoreInput = {
  stageMatches: boolean;
  necessityLevel: NecessityLevel;
  status: ItemStatus;
  budgetFits?: boolean;
  userInterest?: boolean;
  affiliateCommissionRate?: number;
};

export type RecommendationItem = RecommendationScoreInput & {
  id: string;
};

export type ItemTrustRuleInput = {
  necessityLevel: NecessityLevel;
  skipReasonText?: string | null;
  medicalDisclaimerRequired?: boolean;
  medicalDisclaimerText?: string | null;
};

export type ItemTrustRuleViolation =
  | "SKIP_REASON_REQUIRED"
  | "MEDICAL_DISCLAIMER_REQUIRED";

export function calculateRecommendationScore(input: RecommendationScoreInput): number {
  const stageScore = input.stageMatches ? 35 : 0;
  const necessityScore = NECESSITY_SCORE[input.necessityLevel];
  const statusScore = STATUS_SCORE[input.status];
  const budgetScore = input.budgetFits ? 10 : 0;
  const interestScore = input.userInterest ? 5 : 0;

  return stageScore + necessityScore + statusScore + budgetScore + interestScore;
}

export function sortRecommendedItems<T extends RecommendationItem>(items: T[]): T[] {
  return items
    .filter((item) => shouldShowInNeededNow(item.status))
    .slice()
    .sort((left, right) => {
      const scoreDiff = calculateRecommendationScore(right) - calculateRecommendationScore(left);
      return scoreDiff === 0 ? left.id.localeCompare(right.id) : scoreDiff;
    });
}

export function shouldShowInNeededNow(status: ItemStatus): boolean {
  return !EXCLUDED_NOW_NEEDED_STATUSES.has(status);
}

export function validateItemTrustRules(input: ItemTrustRuleInput): ItemTrustRuleViolation[] {
  const violations: ItemTrustRuleViolation[] = [];

  if (
    (input.necessityLevel === "convenience" || input.necessityLevel === "optional") &&
    !input.skipReasonText?.trim()
  ) {
    violations.push("SKIP_REASON_REQUIRED");
  }

  if (input.medicalDisclaimerRequired && !input.medicalDisclaimerText?.trim()) {
    violations.push("MEDICAL_DISCLAIMER_REQUIRED");
  }

  return violations;
}
