import { describe, expect, it } from "vitest";
import { evaluateExternalReadiness } from "./release5-external-readiness";

function approvedEnv() {
  return {
    EXPO_PUBLIC_API_BASE_URL: "https://api.wooriai.kr/api/v1",
    LEGAL_OPERATOR_NAME: "우리아이 주식회사",
    PRIVACY_POLICY_URL: "https://wooriai.kr/privacy",
    TERMS_URL: "https://wooriai.kr/terms",
    SUPPORT_URL: "https://wooriai.kr/support",
    STATUS_PAGE_URL: "https://status.wooriai.kr",
    DATABASE_URL: "postgresql://release-db/wooriai",
    REDIS_URL: "rediss://release-cache:6379",
    S3_ENDPOINT: "https://objects.wooriai.kr",
    S3_BUCKET: "wooriai-production",
    S3_ACCESS_KEY_ID: "provided-access-id",
    S3_SECRET_ACCESS_KEY: "provided-secret",
    OAUTH_KAKAO_CLIENT_ID: "provided-kakao-id",
    OAUTH_APPLE_CLIENT_ID: "provided-apple-id",
    OAUTH_GOOGLE_CLIENT_ID: "provided-google-id",
    NOTIFICATION_PROVIDER_MODE: "live",
    PUSH_PROVIDER_CREDENTIAL: "provided-push-credential",
    RECALL_PROVIDER_MODE: "live",
    RECALL_PROVIDER_WEBHOOK_SECRET: "provided-recall-secret",
    MERCHANT_FEED_MODE: "live",
    MERCHANT_FEED_CREDENTIAL: "provided-merchant-credential",
    INTERNAL_METRICS_TOKEN: "provided-metrics-token",
    ANDROID_SIGNING_KEYSTORE_PATH: "D:/release/wooriai.jks",
    ANDROID_SIGNING_KEY_ALIAS: "wooriai-release",
    ANDROID_SIGNING_STORE_PASSWORD_ENV: "STORE_PASSWORD",
    ANDROID_SIGNING_KEY_PASSWORD_ENV: "KEY_PASSWORD",
    STORE_PASSWORD: "provided-store-password",
    KEY_PASSWORD: "provided-key-password"
  };
}

describe("external release readiness", () => {
  it("fails closed for the current placeholder Android identity", () => {
    const result = evaluateExternalReadiness({
      env: approvedEnv(),
      identity: { packageName: "com.anonymous.wooriai", version: "0.0.0", versionCode: 1 },
      pathExists: () => true
    });
    expect(result.status).toBe("EXTERNAL_BLOCKED");
    expect(result.checks.find((entry) => entry.id === "android_identity")?.issues).toEqual([
      "ANDROID_APPLICATION_ID_APPROVAL_REQUIRED",
      "ANDROID_VERSION_APPROVAL_REQUIRED"
    ]);
  });

  it("rejects placeholder endpoints and missing referenced signing passwords", () => {
    const env = approvedEnv();
    env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000/api/v1";
    delete (env as Partial<typeof env>).KEY_PASSWORD;
    const result = evaluateExternalReadiness({
      env,
      identity: { packageName: "kr.wooriai.app", version: "1.0.0", versionCode: 1 },
      pathExists: () => true
    });
    expect(result.checks.find((entry) => entry.id === "mobile_api")?.present).toBe(false);
    expect(result.checks.find((entry) => entry.id === "signing")?.issues).toContain("ANDROID_SIGNING_KEY_PASSWORD_REQUIRED");
  });

  it("rejects configured-but-non-live provider modes", () => {
    const env = approvedEnv();
    env.NOTIFICATION_PROVIDER_MODE = "mock";
    env.RECALL_PROVIDER_MODE = "disabled";
    env.MERCHANT_FEED_MODE = "local";
    const result = evaluateExternalReadiness({
      env,
      identity: { packageName: "kr.wooriai.app", version: "1.0.0", versionCode: 1 },
      pathExists: () => true
    });
    expect(result.checks.find((entry) => entry.id === "push")?.issues).toEqual(["NOTIFICATION_PROVIDER_MODE_LIVE_REQUIRED"]);
    expect(result.checks.find((entry) => entry.id === "recall")?.issues).toEqual(["RECALL_PROVIDER_MODE_LIVE_REQUIRED"]);
    expect(result.checks.find((entry) => entry.id === "merchant")?.issues).toEqual(["MERCHANT_FEED_MODE_LIVE_REQUIRED"]);
  });

  it("passes only when every approved external input is present", () => {
    const result = evaluateExternalReadiness({
      env: approvedEnv(),
      identity: { packageName: "kr.wooriai.app", version: "1.0.0", versionCode: 1 },
      pathExists: () => true
    });
    expect(result.status).toBe("PASS");
    expect(result.checks.every((entry) => entry.status === "PASS")).toBe(true);
  });
});
