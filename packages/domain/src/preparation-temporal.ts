const ACTIVE_TEMPORAL_STATES = new Set(["owned", "borrowed", "rented", "replacement_needed", "replacement_due"]);

export type PreparationDueEvent = {
  eventType: "replacement_due" | "recurring_purchase_due";
  dueKey: string;
};

export function preparationDateKeyKst(referenceTime: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(referenceTime);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function dateKey(value: Date | null | undefined) {
  return value?.toISOString().slice(0, 10) ?? null;
}

export function preparationDueEvents(input: {
  state: string;
  replacementDueAt?: Date | null;
  nextPurchaseDueAt?: Date | null;
  referenceTime: Date;
}): PreparationDueEvent[] {
  if (!ACTIVE_TEMPORAL_STATES.has(input.state)) return [];
  const today = preparationDateKeyKst(input.referenceTime);
  const replacement = dateKey(input.replacementDueAt);
  const recurring = dateKey(input.nextPurchaseDueAt);
  return [
    replacement && replacement <= today ? { eventType: "replacement_due" as const, dueKey: replacement } : null,
    recurring && recurring <= today ? { eventType: "recurring_purchase_due" as const, dueKey: recurring } : null
  ].filter((event): event is PreparationDueEvent => event !== null);
}
