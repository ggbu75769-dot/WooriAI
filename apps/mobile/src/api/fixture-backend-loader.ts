import * as fixtureBackend from "./local-backend";

// Vitest/Node uses the normal ESM import. Native startup uses the platform-specific lazy proxy.
export { fixtureBackend };
