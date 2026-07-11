/**
 * Reads a required secret from the environment. In production, a missing secret is a
 * misconfiguration and must fail fast instead of silently falling back to a well-known
 * development value. Outside production (dev/test), the fallback keeps local workflows
 * and the test suite working without extra setup.
 */
export function requireSecret(envKey: string, devFallback: string): string {
  const value = process.env[envKey];
  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${envKey} must be set when NODE_ENV=production`);
  }

  return devFallback;
}
