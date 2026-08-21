import type { QueryClient } from "@tanstack/react-query";

/**
 * FIX-118A (M-3): app-wide handle on the single QueryClient created in app/_layout.tsx, for the
 * non-React code that has to drop its cache.
 *
 * Why this exists: user-scoped query keys in this app carry no user identifier -- `["children"]`,
 * `["my-devices"]`, `["household-members"]`, `["home", childId]` and friends are all keyed by the
 * *resource*, not by *whose* resource it is. PRIV-104's session teardown
 * (src/offline/session-teardown.ts) therefore cleared zustand stores and the SQLite offline store
 * but left react-query holding the outgoing account's responses, and with the app's 30s
 * `staleTime` (see the QueryClient defaults) the incoming account rendered the previous account's
 * child list / device list from cache for up to 30 seconds before the first refetch replaced it.
 *
 * A module-level registry (rather than importing the client object directly) keeps the dependency
 * pointing one way only: app/_layout.tsx -> registry <- session-teardown.ts. session-teardown must
 * never import app/_layout.tsx (that would pull expo-router and every screen into its import
 * graph, and create a cycle through sync-controller.ts).
 *
 * `import type` above is erased at compile time, so this module stays importable from vitest's
 * node environment with no react-query runtime import of its own.
 */

let appQueryClient: QueryClient | null = null;

/** Called once from app/_layout.tsx module scope, right after the QueryClient is constructed. */
export function registerAppQueryClient(client: QueryClient): void {
  appQueryClient = client;
}

export function getAppQueryClient(): QueryClient | null {
  return appQueryClient;
}

/**
 * Drops every cached query/mutation. A no-op before registration (unit tests, and the brief
 * window before app/_layout.tsx's module body runs), which is the safe direction: the cache we
 * would have cleared does not exist yet.
 */
export function clearAppQueryCache(): void {
  appQueryClient?.clear();
}

/** Test-only: unregister so one test file's client never leaks into another's. */
export function resetAppQueryClientRegistryForTests(): void {
  appQueryClient = null;
}
