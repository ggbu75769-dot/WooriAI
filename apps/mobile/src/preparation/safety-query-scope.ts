export type SafetySessionIdentity = {
  sessionGeneration: number;
  userId: string | null;
  defaultHouseholdId: string | null;
  isTestSession: boolean;
};

export function safetyAlternativeScopeKey(
  session: SafetySessionIdentity,
  contextKey: string | null
) {
  return JSON.stringify([
    session.sessionGeneration,
    session.isTestSession ? "test-session" : (session.userId ?? "anonymous"),
    session.defaultHouseholdId ?? "",
    contextKey ?? ""
  ]);
}

export function activeSafetyAlertAfterScopeChange(
  previousScopeKey: string,
  nextScopeKey: string,
  currentAlertId: string | null
) {
  return previousScopeKey === nextScopeKey ? currentAlertId : null;
}

export function safetyAlternativesQueryKey(scopeKey: string, alertId: string | null) {
  return ["catalog-v2", "safety-alternatives", scopeKey, alertId] as const;
}
