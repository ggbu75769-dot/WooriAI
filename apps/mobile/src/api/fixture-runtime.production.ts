const disabledFixtureCall = (): never => {
  throw new Error("FIXTURE_RUNTIME_DISABLED");
};

export const LOCAL_CHILD_ID = "";
export const LOCAL_HOUSEHOLD_ID = "";
export const LOCAL_USER_ID = "";
export const fixtureSessionToken = "";
export const fixtureRuntimeEnabled = false;
export const localCategoryNameKo: Record<string, string> = {};
export const ensureLocalBackendSeeded = () => undefined;
export const startLocalOnboardingSession = () => undefined;
export const resetLocalBackend = () => undefined;

// Production never executes this namespace: client.ts checks fixtureRuntimeEnabled before
// consulting it. Keep the proxy structurally typed here; even a type-only import of the local
// backend is discovered by Metro and would pull fixture persistence into the production graph.
export const fixtureBackend = new Proxy(
  {},
  { get: () => disabledFixtureCall }
) as Record<string, (...args: unknown[]) => never>;

export function pixelEvidenceId(screenIds: string): string {
  return `screen-${screenIds}`;
}
