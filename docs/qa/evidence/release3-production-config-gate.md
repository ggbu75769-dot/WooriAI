# WooriAI Release Gate Evidence

Generated: 2026-08-11T23:49:42.109Z
Mode: production-config

| Gate | Command | Result | Duration |
| --- | --- | --- | --- |
| Production config | `pnpm release:config` | FAIL | 1ms |

## Production configuration blockers

- `ANDROID_PACKAGE_PLACEHOLDER`: Android package name must be approved and non-placeholder.
- `APP_VERSION_PLACEHOLDER`: Application version must be approved and non-placeholder.
- `NODE_ENV_NOT_PRODUCTION`: NODE_ENV must be production.
- `MOBILE_BUILD_PROFILE_NOT_PRODUCTION`: The mobile build profile must be production.
- `MOBILE_TEST_LOGIN_NOT_DISABLED`: Test login must be explicitly disabled in production.
- `MOBILE_PIXEL_LOCK_NOT_DISABLED`: Pixel Lock fixture mode must be explicitly disabled in production.
- `DEV_AUTH_NOT_DISABLED`: Development authentication must be explicitly disabled.
- `LEGAL_OPERATOR_PLACEHOLDER`: Approved legal operator information is required.
- `PRIVACY_POLICY_URL_INVALID`: PRIVACY_POLICY_URL must be an approved HTTPS URL.
- `TERMS_URL_INVALID`: TERMS_URL must be an approved HTTPS URL.
- `SUPPORT_URL_INVALID`: SUPPORT_URL must be an approved HTTPS URL.
- `STATUS_PAGE_URL_INVALID`: STATUS_PAGE_URL must be an approved HTTPS URL.
- `MOBILE_API_URL_INVALID`: EXPO_PUBLIC_API_BASE_URL must be an approved HTTPS URL.
- `REDIS_URL_INVALID`: A valid Redis URL is required for queues and distributed protection.
- `S3_ENDPOINT_INVALID`: S3_ENDPOINT must be an approved HTTPS URL.
- `S3_BUCKET_PLACEHOLDER`: S3_BUCKET must be production-managed.
- `S3_ACCESS_KEY_ID_PLACEHOLDER`: S3_ACCESS_KEY_ID must be production-managed.
- `S3_SECRET_ACCESS_KEY_PLACEHOLDER`: S3_SECRET_ACCESS_KEY must be production-managed.
- `KAKAO_CLIENT_ID_PLACEHOLDER`: Production Kakao client ID is required.
- `KAKAO_REDIRECT_INVALID`: Kakao redirects must include the approved exact app callback and no insecure URL.
- `FEATURE_ANALYTICS_DEFAULT_UNSAFE`: FEATURE_ANALYTICS_DEFAULT must default to false for production release.
- `FEATURE_AFFILIATE_DEFAULT_UNSAFE`: FEATURE_AFFILIATE_DEFAULT must default to false for production release.
- `FEATURE_IMPORT_DEFAULT_UNSAFE`: FEATURE_IMPORT_DEFAULT must default to false for production release.
- `FEATURE_NOTIFICATION_DEFAULT_UNSAFE`: FEATURE_NOTIFICATION_DEFAULT must default to false for production release.
- `ANALYTICS_OPT_IN_DEFAULT_UNSAFE`: Analytics consent must default to false.
- `AFFILIATE_ALLOWLIST_MISSING`: A production affiliate domain allowlist is required.
- `ANDROID_SIGNING_KEYSTORE_PATH_MISSING`: ANDROID_SIGNING_KEYSTORE_PATH must reference externally managed signing material.
- `ANDROID_SIGNING_KEY_ALIAS_MISSING`: ANDROID_SIGNING_KEY_ALIAS must reference externally managed signing material.
- `ANDROID_SIGNING_STORE_PASSWORD_ENV_MISSING`: ANDROID_SIGNING_STORE_PASSWORD_ENV must reference externally managed signing material.
- `ANDROID_SIGNING_KEY_PASSWORD_ENV_MISSING`: ANDROID_SIGNING_KEY_PASSWORD_ENV must reference externally managed signing material.
- `MIGRATION_HEAD_MISMATCH`: Expected migration head must equal the repository migration head.
- `CONTRACT_DRIFT_UNVERIFIED`: Generated contract drift check must pass.
- `JWT_ACCESS_SECRET_PLACEHOLDER`: JWT_ACCESS_SECRET must be injected from production secret storage.
- `JWT_REFRESH_SECRET_PLACEHOLDER`: JWT_REFRESH_SECRET must be injected from production secret storage.
- `AFFILIATE_CLICK_IP_SALT_PLACEHOLDER`: AFFILIATE_CLICK_IP_SALT must be injected from production secret storage.
- `ANALYTICS_ANON_SALT_PLACEHOLDER`: ANALYTICS_ANON_SALT must be injected from production secret storage.
- `PRIVACY_STATUS_TOKEN_SECRET_PLACEHOLDER`: PRIVACY_STATUS_TOKEN_SECRET must be injected from production secret storage.
- `PRIVACY_HASH_SALT_PLACEHOLDER`: PRIVACY_HASH_SALT must be injected from production secret storage.
- `DEVICE_ID_HASH_SALT_PLACEHOLDER`: DEVICE_ID_HASH_SALT must be injected from production secret storage.
- `RATE_LIMIT_KEY_SALT_PLACEHOLDER`: RATE_LIMIT_KEY_SALT must be injected from production secret storage.
- `INTERNAL_METRICS_TOKEN_PLACEHOLDER`: INTERNAL_METRICS_TOKEN must be injected from production secret storage.
- `OAUTH_MOCK_ADAPTER`: Production OAuth adapter must be http.
- `QUEUE_MOCK_ADAPTER`: Production queue adapter must be redis.
- `OBJECT_STORAGE_MOCK_ADAPTER`: Production object storage adapter must be s3-compatible.
- `PRIVACY_PROCESSOR_NOT_LIVE`: Production privacy processor mode must be live.
- `NOTIFICATION_PROVIDER_NOT_LIVE`: Production notification provider mode must be live.

## Evidence boundary

- Local gates do not prove production deployment, real OAuth, store signing, backup restore, or closed-beta stability.
- Android release proof requires an installed build and adb screencaps; browser screenshots are not accepted.
- The fixture mode validates only gate logic and never certifies the repository's current placeholder values.
