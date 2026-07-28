export type DuplicatePurchaseTarget = "mother" | "child" | "caregiver" | "household" | "shared";
export type DuplicatePurchaseState =
  | "not_considered" | "need" | "researching" | "planned" | "ordered" | "owned"
  | "borrowed" | "rented" | "gift_expected" | "gifted" | "not_needed"
  | "replacement_needed" | "replacement_due" | "replaced" | "retired" | "ended";

const existingRiskStates = new Set<DuplicatePurchaseState>(["ordered", "owned", "borrowed", "rented", "gifted"]);
const purchaseIntentStates = new Set<DuplicatePurchaseState>(["need", "researching", "planned", "ordered"]);

export function isDuplicatePurchaseRisk(input: {
  canonicalItemId: string;
  targetSubject: DuplicatePurchaseTarget;
  childId: string | null;
  requestedState: DuplicatePurchaseState;
  existing: {
    canonicalItemId: string;
    childId: string | null;
    state: DuplicatePurchaseState;
  };
}) {
  if (input.canonicalItemId !== input.existing.canonicalItemId) return false;
  if (!purchaseIntentStates.has(input.requestedState) || !existingRiskStates.has(input.existing.state)) return false;
  const householdScoped = input.targetSubject === "household" || input.targetSubject === "shared" || input.targetSubject === "caregiver";
  return householdScoped || input.childId === input.existing.childId;
}
