/**
 * Returns true only when NODE_ENV is explicitly "development" or "test". Any other value,
 * including an unset NODE_ENV (e.g. a staging deploy that forgot to set it), is treated as
 * a production-like environment for the purposes of secret fallbacks and dev-only stubs.
 */
export function isDevOrTestEnv(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  return nodeEnv === "development" || nodeEnv === "test";
}

/**
 * Reads a required secret from the environment. A missing secret is only tolerated when
 * NODE_ENV is explicitly "development" or "test", where a well-known fallback keeps local
 * workflows and the test suite working without extra setup. Any other NODE_ENV value -
 * including production and an unset/misconfigured NODE_ENV - must fail fast instead of
 * silently accepting the publicly-known fallback value.
 */
export function requireSecret(envKey: string, devFallback: string): string {
  const value = process.env[envKey];
  if (value) {
    return value;
  }

  if (isDevOrTestEnv()) {
    return devFallback;
  }

  throw new Error(
    `${envKey} must be set unless NODE_ENV is "development" or "test" (current: ${process.env.NODE_ENV ?? "unset"})`
  );
}

/**
 * Validates that every secret required for a real deployment is present. Intended to be
 * called once at application boot (see src/main.ts) so a misconfigured production/staging
 * deploy fails immediately instead of silently running with publicly-known dev fallbacks.
 * In development/test, requireSecret's fallback keeps this a no-op.
 */
export function assertRequiredSecretsConfigured(): void {
  const placeholder = "unused-fallback-for-boot-check";
  requireSecret("JWT_ACCESS_SECRET", placeholder);
  requireSecret("JWT_REFRESH_SECRET", placeholder);
  requireSecret("WOORIAI_ADMIN_TOKEN", placeholder);
  // 미설정 시 첫 클릭/분석 요청에서야 500이 나는 지연 실패를 부트 실패로 앞당긴다.
  // (OAUTH_KAKAO_*는 카카오 실연동 활성화 전까지 부트 강제 대상에서 제외)
  requireSecret("AFFILIATE_ALLOWED_DOMAINS", placeholder);
  requireSecret("AFFILIATE_CLICK_IP_SALT", placeholder);
  requireSecret("ANALYTICS_ANON_SALT", placeholder);
}
