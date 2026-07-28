export type MobileReleaseConfig = {
  version?: string;
  android?: { package?: string; versionCode?: number };
};

export type ReleaseConfigIssue = {
  code: string;
  message: string;
};

export type ProductionReleaseConfigInput = {
  env: Record<string, string | undefined>;
  mobile: MobileReleaseConfig;
  migrationHead: string;
};

const placeholderPattern = /(?:change-me|placeholder|example\.(?:com|org)|localhost|\.local(?:\b|$)|dev-)/i;

function value(env: Record<string, string | undefined>, key: string) {
  return env[key]?.trim() ?? "";
}

function isMissingOrPlaceholder(input: string) {
  return input.length === 0 || placeholderPattern.test(input);
}

function isHttpsUrl(input: string) {
  try {
    const parsed = new URL(input);
    return parsed.protocol === "https:" && !placeholderPattern.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function validateProductionReleaseConfig(
  input: ProductionReleaseConfigInput
): ReleaseConfigIssue[] {
  const { env, mobile, migrationHead } = input;
  const issues: ReleaseConfigIssue[] = [];
  const add = (code: string, message: string) => issues.push({ code, message });

  if (!mobile.android?.package || mobile.android.package === "com.anonymous.wooriai") {
    add("ANDROID_PACKAGE_PLACEHOLDER", "Android package name must be approved and non-placeholder.");
  }
  if (!mobile.version || mobile.version === "0.0.0") {
    add("APP_VERSION_PLACEHOLDER", "Application version must be approved and non-placeholder.");
  }
  if (!Number.isInteger(mobile.android?.versionCode) || (mobile.android?.versionCode ?? 0) < 1) {
    add("ANDROID_VERSION_CODE_INVALID", "Android versionCode must be a positive integer from app.json.");
  }
  if (value(env, "NODE_ENV") !== "production") {
    add("NODE_ENV_NOT_PRODUCTION", "NODE_ENV must be production.");
  }
  if (value(env, "WOORIAI_BUILD_PROFILE") !== "production") {
    add("MOBILE_BUILD_PROFILE_NOT_PRODUCTION", "The mobile build profile must be production.");
  }
  if (value(env, "EXPO_PUBLIC_TEST_LOGIN") !== "0") {
    add("MOBILE_TEST_LOGIN_NOT_DISABLED", "Test login must be explicitly disabled in production.");
  }
  if (value(env, "EXPO_PUBLIC_PIXEL_LOCK") !== "0") {
    add("MOBILE_PIXEL_LOCK_NOT_DISABLED", "Pixel Lock fixture mode must be explicitly disabled in production.");
  }
  if (value(env, "ENABLE_DEV_AUTH") !== "false") {
    add("DEV_AUTH_NOT_DISABLED", "Development authentication must be explicitly disabled.");
  }
  if (["1", "true"].includes(value(env, "CATALOG_INTERNAL_PREVIEW_ENABLED").toLowerCase())) {
    add("CATALOG_INTERNAL_PREVIEW_ENABLED", "Internal catalog preview must be disabled in production.");
  }
  if (isMissingOrPlaceholder(value(env, "LEGAL_OPERATOR_NAME"))) {
    add("LEGAL_OPERATOR_PLACEHOLDER", "Approved legal operator information is required.");
  }

  for (const key of ["PRIVACY_POLICY_URL", "TERMS_URL", "SUPPORT_URL", "STATUS_PAGE_URL"] as const) {
    if (!isHttpsUrl(value(env, key))) {
      add(`${key}_INVALID`, `${key} must be an approved HTTPS URL.`);
    }
  }
  if (!isHttpsUrl(value(env, "EXPO_PUBLIC_API_BASE_URL"))) {
    add("MOBILE_API_URL_INVALID", "EXPO_PUBLIC_API_BASE_URL must be an approved HTTPS URL.");
  }

  try {
    const redis = new URL(value(env, "REDIS_URL"));
    if (redis.protocol !== "redis:" && redis.protocol !== "rediss:") throw new Error("invalid protocol");
  } catch {
    add("REDIS_URL_INVALID", "A valid Redis URL is required for queues and distributed protection.");
  }
  if (!isHttpsUrl(value(env, "S3_ENDPOINT"))) add("S3_ENDPOINT_INVALID", "S3_ENDPOINT must be an approved HTTPS URL.");
  for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
    if (isMissingOrPlaceholder(value(env, key))) add(`${key}_PLACEHOLDER`, `${key} must be production-managed.`);
  }

  if (isMissingOrPlaceholder(value(env, "OAUTH_KAKAO_CLIENT_ID"))) {
    add("KAKAO_CLIENT_ID_PLACEHOLDER", "Production Kakao client ID is required.");
  }
  const redirects = value(env, "OAUTH_KAKAO_REDIRECT_URIS")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (
    redirects.length === 0 ||
    redirects.some((redirect) => placeholderPattern.test(redirect) || redirect.startsWith("http://")) ||
    !redirects.some((redirect) => redirect.startsWith("wooriai://oauth/kakao"))
  ) {
    add("KAKAO_REDIRECT_INVALID", "Kakao redirects must include the approved exact app callback and no insecure URL.");
  }

  for (const key of [
    "FEATURE_ANALYTICS_DEFAULT",
    "FEATURE_AFFILIATE_DEFAULT",
    "FEATURE_IMPORT_DEFAULT",
    "FEATURE_NOTIFICATION_DEFAULT"
  ] as const) {
    if (value(env, key) !== "false") {
      add(`${key}_UNSAFE`, `${key} must default to false for production release.`);
    }
  }
  if (value(env, "ANALYTICS_OPT_IN_DEFAULT") !== "false") {
    add("ANALYTICS_OPT_IN_DEFAULT_UNSAFE", "Analytics consent must default to false.");
  }

  if (isMissingOrPlaceholder(value(env, "AFFILIATE_ALLOWED_DOMAINS"))) {
    add("AFFILIATE_ALLOWLIST_MISSING", "A production affiliate domain allowlist is required.");
  }

  const signingKeys = [
    "ANDROID_SIGNING_KEYSTORE_PATH",
    "ANDROID_SIGNING_KEY_ALIAS",
    "ANDROID_SIGNING_STORE_PASSWORD_ENV",
    "ANDROID_SIGNING_KEY_PASSWORD_ENV"
  ] as const;
  for (const key of signingKeys) {
    if (isMissingOrPlaceholder(value(env, key))) {
      add(`${key}_MISSING`, `${key} must reference externally managed signing material.`);
    }
  }

  const storePasswordKey = value(env, "ANDROID_SIGNING_STORE_PASSWORD_ENV");
  const keyPasswordKey = value(env, "ANDROID_SIGNING_KEY_PASSWORD_ENV");
  for (const secretKey of [storePasswordKey, keyPasswordKey].filter(Boolean)) {
    if (!value(env, secretKey)) {
      add("ANDROID_SIGNING_SECRET_MISSING", `Referenced signing secret ${secretKey} is not present.`);
    }
  }

  if (!migrationHead || value(env, "RELEASE_EXPECTED_MIGRATION_HEAD") !== migrationHead) {
    add("MIGRATION_HEAD_MISMATCH", "Expected migration head must equal the repository migration head.");
  }
  if (value(env, "CONTRACT_GENERATION_CHECK") !== "passed") {
    add("CONTRACT_DRIFT_UNVERIFIED", "Generated contract drift check must pass.");
  }

  for (const key of [
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "AFFILIATE_CLICK_IP_SALT",
    "ANALYTICS_ANON_SALT",
    "PRIVACY_STATUS_TOKEN_SECRET",
    "PRIVACY_HASH_SALT",
    "DEVICE_ID_HASH_SALT",
    "RATE_LIMIT_KEY_SALT",
    "INTERNAL_METRICS_TOKEN"
  ] as const) {
    if (isMissingOrPlaceholder(value(env, key))) {
      add(`${key}_PLACEHOLDER`, `${key} must be injected from production secret storage.`);
    }
  }
  if (value(env, "OAUTH_PROVIDER_ADAPTER") !== "http") {
    add("OAUTH_MOCK_ADAPTER", "Production OAuth adapter must be http.");
  }
  if (value(env, "QUEUE_ADAPTER") !== "redis") {
    add("QUEUE_MOCK_ADAPTER", "Production queue adapter must be redis.");
  }
  if (value(env, "OBJECT_STORAGE_ADAPTER") !== "s3") {
    add("OBJECT_STORAGE_MOCK_ADAPTER", "Production object storage adapter must be s3-compatible.");
  }
  if (value(env, "PRIVACY_PROCESSOR_MODE") !== "live") {
    add("PRIVACY_PROCESSOR_NOT_LIVE", "Production privacy processor mode must be live.");
  }
  if (value(env, "NOTIFICATION_PROVIDER_MODE") !== "live") {
    add("NOTIFICATION_PROVIDER_NOT_LIVE", "Production notification provider mode must be live.");
  }

  return issues;
}
