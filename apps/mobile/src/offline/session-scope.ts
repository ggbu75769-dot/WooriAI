export const LEGACY_UNSCOPED_SCOPE_KEY = "__legacy_unscoped__";

export function makeOfflineScopeKey(userId: string, householdId: string): string {
  return `v1:${encodeURIComponent(userId)}:${encodeURIComponent(householdId)}`;
}

export function resolveOfflineScopeKey(input: {
  accessToken: string | null;
  userId: string | null;
  defaultHouseholdId: string | null;
  isTestSession: boolean;
  testUserId?: string | null;
  testHouseholdId?: string | null;
}): string | null {
  if (input.isTestSession) {
    if (!input.testUserId || !input.testHouseholdId) {
      return null;
    }
    return makeOfflineScopeKey(input.testUserId, input.testHouseholdId);
  }
  if (!input.accessToken || !input.userId || !input.defaultHouseholdId) {
    return null;
  }
  return makeOfflineScopeKey(input.userId, input.defaultHouseholdId);
}
