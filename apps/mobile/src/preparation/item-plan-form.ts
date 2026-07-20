import type { CatalogItemPlan, CatalogPlanState } from "../api/client";

export function isValidDateOnly(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function itemPlanFieldVisibility(input: {
  state: CatalogPlanState | undefined;
  recurringEnabled: boolean;
  replacementEnabled: boolean;
  canViewPrivatePlan: boolean;
}) {
  const acquired = ["ordered", "owned", "borrowed", "rented", "gifted"].includes(input.state ?? "");
  return {
    showPrivatePlan: input.canViewPrivatePlan,
    showAcquiredFields: input.canViewPrivatePlan && acquired,
    showRecurringField: input.canViewPrivatePlan && input.recurringEnabled,
    showReplacementField: input.canViewPrivatePlan && input.replacementEnabled
  };
}

export function itemPlanDraftChanged(
  plan: Partial<CatalogItemPlan> | null | undefined,
  draft: {
    quantityNeeded: string;
    quantityOwned: string;
    assignedUserId: string | null;
    budgetKrw: string;
    size: string;
    variant: string;
    dueDate: string;
    purchasedAt: string;
    openedAt: string;
    replacementDueAt: string;
    storageLocation: string;
    recurringIntervalDays: string;
    acquisitionType: CatalogItemPlan["acquisitionMode"];
    notes: string;
  }
) {
  const value = (input: string | null | undefined) => input ?? "";
  return [
    [value(plan?.quantityNeeded?.toString() ?? plan?.desiredQuantity?.toString()), draft.quantityNeeded],
    [value(plan?.quantityOwned?.toString() ?? plan?.ownedQuantity?.toString()), draft.quantityOwned],
    [value(plan?.assignedUserId), value(draft.assignedUserId)],
    [value(plan?.budgetKrw?.toString()), draft.budgetKrw],
    [value(plan?.size), draft.size],
    [value(plan?.variant), draft.variant],
    [value(plan?.dueDate?.slice(0, 10)), draft.dueDate],
    [value(plan?.purchasedAt?.slice(0, 10)), draft.purchasedAt],
    [value(plan?.openedAt?.slice(0, 10)), draft.openedAt],
    [value(plan?.replacementDueAt?.slice(0, 10)), draft.replacementDueAt],
    [value(plan?.storageLocation), draft.storageLocation],
    [value(plan?.recurringIntervalDays?.toString()), draft.recurringIntervalDays],
    [value(plan?.acquisitionType ?? plan?.acquisitionMode), value(draft.acquisitionType)],
    [value(plan?.notes ?? plan?.note), draft.notes]
  ].some(([saved, current]) => saved !== current);
}
