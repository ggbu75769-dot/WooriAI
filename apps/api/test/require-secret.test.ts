import { afterEach, describe, expect, it } from "vitest";
import { requireSecret } from "../src/common/config/require-secret";

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
      `${envKey} must be set when NODE_ENV=production`
    );
  });

  it("uses the explicit environment value even in production", () => {
    process.env.NODE_ENV = "production";
    process.env[envKey] = "configured-secret";

    expect(requireSecret(envKey, "dev-fallback")).toBe("configured-secret");
  });

  it("falls back to the dev value outside production", () => {
    process.env.NODE_ENV = "test";
    delete process.env[envKey];

    expect(requireSecret(envKey, "dev-fallback")).toBe("dev-fallback");
  });
});
