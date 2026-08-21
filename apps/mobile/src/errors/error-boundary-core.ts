/**
 * MOB-108 — pure logic for the global ErrorBoundary (src/errors/ErrorBoundary.tsx).
 *
 * Kept free of react/react-native imports so the reset/log behavior is unit-testable under
 * this repo's plain-node vitest setup (screens aren't runtime-rendered here — see the
 * source-contract convention in design-foundation.test.ts / a11y-contract.test.ts).
 */

export interface ErrorBoundaryState {
  /** The caught render error, or null when the tree is healthy. */
  error: Error | null;
  /**
   * Bumped on every retry and used as the children's React key, so a retry remounts the
   * whole subtree from scratch instead of resuming a component tree in a broken state.
   */
  retryKey: number;
}

/** Structured prefix for crash logs (no crash pipeline yet — Sentry 추후, grep-able until then). */
export const ERROR_BOUNDARY_LOG_PREFIX = "[MOB-108][ErrorBoundary]";

export function initialBoundaryState(): ErrorBoundaryState {
  return { error: null, retryKey: 0 };
}

/** getDerivedStateFromError payload — normalizes non-Error throwables (strings, objects). */
export function caughtBoundaryState(thrown: unknown): Pick<ErrorBoundaryState, "error"> {
  return { error: thrown instanceof Error ? thrown : new Error(String(thrown)) };
}

/** [다시 시도] handler payload — clears the error and bumps the remount key. */
export function resetBoundaryState(previous: ErrorBoundaryState): ErrorBoundaryState {
  return { error: null, retryKey: previous.retryKey + 1 };
}

/**
 * console.error arguments for componentDidCatch: a stable structured prefix line plus a
 * plain-object payload (survives Metro/Hermes console serialization).
 */
export function formatBoundaryLog(
  error: Error,
  componentStack: string | null | undefined
): [string, { name: string; message: string; stack: string | null; componentStack: string | null }] {
  return [
    `${ERROR_BOUNDARY_LOG_PREFIX} render crash: ${error.message}`,
    {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      componentStack: componentStack ?? null
    }
  ];
}

/**
 * Truncated stack shown on the fallback screen in dev builds only (__DEV__); production
 * users never see raw stacks.
 */
export function devErrorDetail(error: Error | null, isDev: boolean, maxLines = 6): string | null {
  if (!isDev || error === null) return null;
  const raw = error.stack ?? `${error.name}: ${error.message}`;
  const lines = raw.split("\n").slice(0, maxLines);
  return lines.join("\n").trim() || null;
}
