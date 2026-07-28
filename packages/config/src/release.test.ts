import { describe, expect, it } from "vitest";
import { validateProductionReleaseConfig } from "./release";

const migrationHead = "000012_release3_foundation";

function fixtureEnv(): Record<string, string> {
  return {
    NODE_ENV: "production",
    WOORIAI_BUILD_PROFILE: "production",
    EXPO_PUBLIC_TEST_LOGIN: "0",
    EXPO_PUBLIC_PIXEL_LOCK: "0",
    ENABLE_DEV_AUTH: "false",
    CATALOG_INTERNAL_PREVIEW_ENABLED: "0",
    LEGAL_OPERATOR_NAME: "Approved Operator",
    PRIVACY_POLICY_URL: "https://legal.wooriai.test/privacy",
    TERMS_URL: "https://legal.wooriai.test/terms",
    SUPPORT_URL: "https://support.wooriai.test",
    STATUS_PAGE_URL: "https://status.wooriai.test",
    EXPO_PUBLIC_API_BASE_URL: "https://api.wooriai.test/api/v1",
    REDIS_URL: "rediss://cache.wooriai.test:6379",
    S3_ENDPOINT: "https://objects.wooriai.test",
    S3_BUCKET: "wooriai-production",
    S3_ACCESS_KEY_ID: "fixture-access-key",
    S3_SECRET_ACCESS_KEY: "fixture-secret-key",
    OAUTH_KAKAO_CLIENT_ID: "prod-client-123",
    OAUTH_KAKAO_REDIRECT_URIS: "wooriai://oauth/kakao,https://auth.wooriai.test/oauth/kakao",
    FEATURE_ANALYTICS_DEFAULT: "false",
    FEATURE_AFFILIATE_DEFAULT: "false",
    FEATURE_IMPORT_DEFAULT: "false",
    FEATURE_NOTIFICATION_DEFAULT: "false",
    ANALYTICS_OPT_IN_DEFAULT: "false",
    AFFILIATE_ALLOWED_DOMAINS: "coupang.com,naver.com",
    ANDROID_SIGNING_KEYSTORE_PATH: "C:/secure/release.keystore",
    ANDROID_SIGNING_KEY_ALIAS: "release",
    ANDROID_SIGNING_STORE_PASSWORD_ENV: "SIGNING_STORE_PASSWORD",
    ANDROID_SIGNING_KEY_PASSWORD_ENV: "SIGNING_KEY_PASSWORD",
    SIGNING_STORE_PASSWORD: "fixture-only-secret",
    SIGNING_KEY_PASSWORD: "fixture-only-secret",
    RELEASE_EXPECTED_MIGRATION_HEAD: migrationHead,
    CONTRACT_GENERATION_CHECK: "passed",
    JWT_ACCESS_SECRET: "fixture-access-secret",
    JWT_REFRESH_SECRET: "fixture-refresh-secret",
    AFFILIATE_CLICK_IP_SALT: "fixture-affiliate-salt",
    ANALYTICS_ANON_SALT: "fixture-analytics-salt",
    PRIVACY_STATUS_TOKEN_SECRET: "fixture-privacy-status-secret",
    PRIVACY_HASH_SALT: "fixture-privacy-hash-salt",
    DEVICE_ID_HASH_SALT: "fixture-device-hash-salt",
    RATE_LIMIT_KEY_SALT: "fixture-rate-limit-salt",
    INTERNAL_METRICS_TOKEN: "fixture-metrics-token",
    OAUTH_PROVIDER_ADAPTER: "http",
    QUEUE_ADAPTER: "redis",
    OBJECT_STORAGE_ADAPTER: "s3",
    PRIVACY_PROCESSOR_MODE: "live",
    NOTIFICATION_PROVIDER_MODE: "live"
  };
}

describe("production release configuration", () => {
  it("rejects the current placeholder application identity and empty environment", () => {
    const issues = validateProductionReleaseConfig({
      env: {},
      mobile: { version: "0.0.0", android: { package: "com.anonymous.wooriai", versionCode: 1 } },
      migrationHead
    });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["ANDROID_PACKAGE_PLACEHOLDER", "APP_VERSION_PLACEHOLDER", "DEV_AUTH_NOT_DISABLED"])
    );
  });

  it("accepts a non-secret production-shaped fixture", () => {
    expect(
      validateProductionReleaseConfig({
        env: fixtureEnv(),
        mobile: { version: "3.0.0", android: { package: "app.wooriai.mobile", versionCode: 30000 } },
        migrationHead
      })
    ).toEqual([]);
  });

  it("rejects internal catalog preview in production", () => {
    const env = fixtureEnv();
    env.CATALOG_INTERNAL_PREVIEW_ENABLED = "1";
    expect(
      validateProductionReleaseConfig({
        env,
        mobile: { version: "3.0.0", android: { package: "app.wooriai.mobile", versionCode: 30000 } },
        migrationHead
      }).map((issue) => issue.code)
    ).toContain("CATALOG_INTERNAL_PREVIEW_ENABLED");
  });
});
