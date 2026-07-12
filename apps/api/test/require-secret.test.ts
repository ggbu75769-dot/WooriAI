import { afterEach, describe, expect, it } from "vitest";
import { assertRequiredSecretsConfigured, requireSecret } from "../src/common/config/require-secret";

describe("requireSecret", () => {
  const envKey = "TEST_REQUIRE_SECRET";
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    delete process.env[envKey];
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("throws a clear configuration error in production when the secret is not set", () => {
    process.env.NODE_ENV = "production";
    delete process.env[envKey];

    expect(() => requireSecret(envKey, "dev-fallback")).toThrow(
      `${envKey} must be set unless NODE_ENV is "development" or "test" (current: production)`
    );
  });

  it("throws a clear configuration error when NODE_ENV is unset (e.g. a misconfigured staging deploy)", () => {
    delete process.env.NODE_ENV;
    delete process.env[envKey];

    expect(() => requireSecret(envKey, "dev-fallback")).toThrow(
      `${envKey} must be set unless NODE_ENV is "development" or "test" (current: unset)`
    );
  });

  it("uses the explicit environment value even in production", () => {
    process.env.NODE_ENV = "production";
    process.env[envKey] = "configured-secret";

    expect(requireSecret(envKey, "dev-fallback")).toBe("configured-secret");
  });

  it("falls back to the dev value in test", () => {
    process.env.NODE_ENV = "test";
    delete process.env[envKey];

    expect(requireSecret(envKey, "dev-fallback")).toBe("dev-fallback");
  });

  it("falls back to the dev value in development", () => {
    process.env.NODE_ENV = "development";
    delete process.env[envKey];

    expect(requireSecret(envKey, "dev-fallback")).toBe("dev-fallback");
  });
});

describe("assertRequiredSecretsConfigured", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  const bootSecretKeys = [
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "WOORIAI_ADMIN_TOKEN",
    "AFFILIATE_ALLOWED_DOMAINS",
    "AFFILIATE_CLICK_IP_SALT",
    "ANALYTICS_ANON_SALT"
  ] as const;

  const deleteBootSecrets = () => {
    for (const key of bootSecretKeys) {
      delete process.env[key];
    }
  };

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    deleteBootSecrets();
  });

  it("fails boot when NODE_ENV is production and required secrets are missing", () => {
    process.env.NODE_ENV = "production";
    deleteBootSecrets();

    expect(() => assertRequiredSecretsConfigured()).toThrow(/JWT_ACCESS_SECRET must be set/);
  });

  it("fails boot when NODE_ENV is unset and required secrets are missing", () => {
    delete process.env.NODE_ENV;
    deleteBootSecrets();

    expect(() => assertRequiredSecretsConfigured()).toThrow(/JWT_ACCESS_SECRET must be set/);
  });

  it("does not throw in test/development even when secrets are missing", () => {
    process.env.NODE_ENV = "test";
    deleteBootSecrets();

    expect(() => assertRequiredSecretsConfigured()).not.toThrow();
  });

  it("does not throw when all required secrets are explicitly configured", () => {
    process.env.NODE_ENV = "production";
    for (const key of bootSecretKeys) {
      process.env[key] = `configured-${key.toLowerCase()}`;
    }

    expect(() => assertRequiredSecretsConfigured()).not.toThrow();
  });
});
