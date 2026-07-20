const disabledFixtureCall = (): never => {
  throw new Error("FIXTURE_BACKEND_DISABLED");
};

// The production Metro profile swaps this module before dependency collection, so the local
// backend is neither imported nor packaged in a real-user bundle.
export const fixtureBackend = new Proxy(
  {},
  { get: () => disabledFixtureCall }
) as Record<string, (...args: unknown[]) => never>;
