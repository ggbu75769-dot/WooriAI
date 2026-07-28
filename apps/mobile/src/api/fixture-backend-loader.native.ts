type FixtureBackendNamespace = typeof import("./local-backend");

let loadedFixtureBackend: FixtureBackendNamespace | null = null;

function loadFixtureBackend(): FixtureBackendNamespace {
  if (!loadedFixtureBackend) {
    loadedFixtureBackend = require("./local-backend") as FixtureBackendNamespace;
  }
  return loadedFixtureBackend;
}

// Property access is delayed until a local API call actually executes. Creating/importing the
// proxy is startup-safe and does not evaluate the large standalone catalog/backend module.
export const fixtureBackend = new Proxy({} as FixtureBackendNamespace, {
  get: (_target, property) => Reflect.get(loadFixtureBackend(), property)
});
