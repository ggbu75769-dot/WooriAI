export type AndroidIdentity = {
  packageName: string;
  version: string;
  versionCode: number;
};

export type ReadinessCheck = {
  id: string;
  requiredForLive: true;
  present: boolean;
  status: "PASS" | "EXTERNAL_BLOCKED";
  detail: string;
  issues: string[];
};

type ReadinessInput = {
  env: Record<string, string | undefined>;
  identity: AndroidIdentity;
  pathExists: (path: string) => boolean;
};

const placeholderPattern = /change-me|example\.com|\.test(?:\/|$)|localhost|127\.0\.0\.1|^dev-/i;

function configured(env: ReadinessInput["env"], name: string) {
  const value = env[name]?.trim();
  return Boolean(value && !placeholderPattern.test(value));
}

function httpsUrl(env: ReadinessInput["env"], name: string) {
  const value = env[name]?.trim();
  if (!value || placeholderPattern.test(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function result(id: string, detail: string, issues: string[]): ReadinessCheck {
  return {
    id,
    requiredForLive: true,
    present: issues.length === 0,
    status: issues.length === 0 ? "PASS" : "EXTERNAL_BLOCKED",
    detail,
    issues
  };
}

function requiredValues(env: ReadinessInput["env"], names: string[]) {
  return names.filter((name) => !configured(env, name)).map((name) => `${name}_REQUIRED`);
}

function liveProvider(env: ReadinessInput["env"], modeName: string, credentialName: string) {
  return [
    env[modeName]?.trim().toLowerCase() === "live" ? null : `${modeName}_LIVE_REQUIRED`,
    configured(env, credentialName) ? null : `${credentialName}_REQUIRED`
  ].filter((issue): issue is string => Boolean(issue));
}

export function evaluateExternalReadiness({ env, identity, pathExists }: ReadinessInput) {
  const identityIssues = [
    /anonymous|example|change-me/i.test(identity.packageName) ? "ANDROID_APPLICATION_ID_APPROVAL_REQUIRED" : null,
    identity.version === "0.0.0" ? "ANDROID_VERSION_APPROVAL_REQUIRED" : null,
    !Number.isInteger(identity.versionCode) || identity.versionCode < 1 ? "ANDROID_VERSION_CODE_INVALID" : null
  ].filter((issue): issue is string => Boolean(issue));

  const apiIssues = httpsUrl(env, "EXPO_PUBLIC_API_BASE_URL")
    ? []
    : ["EXPO_PUBLIC_API_BASE_URL_HTTPS_REQUIRED"];

  const legalNames = ["LEGAL_OPERATOR_NAME", "PRIVACY_POLICY_URL", "TERMS_URL", "SUPPORT_URL", "STATUS_PAGE_URL"];
  const legalIssues = legalNames.flatMap((name) => {
    if (name === "LEGAL_OPERATOR_NAME") return configured(env, name) ? [] : [`${name}_REQUIRED`];
    return httpsUrl(env, name) ? [] : [`${name}_HTTPS_REQUIRED`];
  });

  const keystorePath = env.ANDROID_SIGNING_KEYSTORE_PATH?.trim() ?? "";
  const storePasswordName = env.ANDROID_SIGNING_STORE_PASSWORD_ENV?.trim() ?? "";
  const keyPasswordName = env.ANDROID_SIGNING_KEY_PASSWORD_ENV?.trim() ?? "";
  const signingIssues = [
    !configured(env, "ANDROID_SIGNING_KEYSTORE_PATH") ? "ANDROID_SIGNING_KEYSTORE_PATH_REQUIRED" : null,
    configured(env, "ANDROID_SIGNING_KEYSTORE_PATH") && !pathExists(keystorePath) ? "ANDROID_SIGNING_KEYSTORE_NOT_FOUND" : null,
    !configured(env, "ANDROID_SIGNING_KEY_ALIAS") ? "ANDROID_SIGNING_KEY_ALIAS_REQUIRED" : null,
    !storePasswordName ? "ANDROID_SIGNING_STORE_PASSWORD_ENV_REQUIRED" : null,
    storePasswordName && !configured(env, storePasswordName) ? "ANDROID_SIGNING_STORE_PASSWORD_REQUIRED" : null,
    !keyPasswordName ? "ANDROID_SIGNING_KEY_PASSWORD_ENV_REQUIRED" : null,
    keyPasswordName && !configured(env, keyPasswordName) ? "ANDROID_SIGNING_KEY_PASSWORD_REQUIRED" : null
  ].filter((issue): issue is string => Boolean(issue));

  const checks = [
    result("android_identity", "Approved package name and monotonic public version", identityIssues),
    result("mobile_api", "Production mobile API uses a non-placeholder HTTPS endpoint", apiIssues),
    result("legal_publication", "Approved operator and public legal/support/status HTTPS URLs", legalIssues),
    result(
      "external_staging_core",
      "PostgreSQL, Redis, and object storage credentials",
      requiredValues(env, ["DATABASE_URL", "REDIS_URL", "S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"])
    ),
    result("oauth", "Live OAuth client identifiers", requiredValues(env, ["OAUTH_KAKAO_CLIENT_ID", "OAUTH_APPLE_CLIENT_ID", "OAUTH_GOOGLE_CLIENT_ID"])),
    result("push", "Live push provider mode and credential", liveProvider(env, "NOTIFICATION_PROVIDER_MODE", "PUSH_PROVIDER_CREDENTIAL")),
    result("recall", "Live recall mode and webhook signature secret", liveProvider(env, "RECALL_PROVIDER_MODE", "RECALL_PROVIDER_WEBHOOK_SECRET")),
    result("merchant", "Live merchant feed mode and credential", liveProvider(env, "MERCHANT_FEED_MODE", "MERCHANT_FEED_CREDENTIAL")),
    result("observability", "Internal metrics authentication is provisioned", requiredValues(env, ["INTERNAL_METRICS_TOKEN"])),
    result("signing", "Production Android keystore, alias, and referenced passwords", signingIssues)
  ];

  return {
    status: checks.every((entry) => entry.present) ? "PASS" as const : "EXTERNAL_BLOCKED" as const,
    checks
  };
}
