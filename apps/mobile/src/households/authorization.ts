const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveAuthorizedHouseholdScope(input: {
  requestedHouseholdId?: string | null;
  defaultHouseholdId?: string | null;
  authorizedHouseholdIds: readonly string[];
}) {
  const authorized = new Set(input.authorizedHouseholdIds.map((id) => id.toLowerCase()));
  const requested = input.requestedHouseholdId && UUID_PATTERN.test(input.requestedHouseholdId)
    ? input.requestedHouseholdId.toLowerCase()
    : null;
  const fallback = input.defaultHouseholdId && authorized.has(input.defaultHouseholdId.toLowerCase())
    ? input.defaultHouseholdId.toLowerCase()
    : input.authorizedHouseholdIds[0]?.toLowerCase() ?? null;
  return {
    householdId: requested && authorized.has(requested) ? requested : fallback,
    rejectedRequestedHousehold: Boolean(requested && !authorized.has(requested))
  };
}
