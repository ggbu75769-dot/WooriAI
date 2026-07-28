import { generate as generateTotp } from "otplib";
import { describe, expect, it } from "vitest";
import { AdminMfaService } from "../src/admin/admin-mfa.service";

describe("AdminMfaService", () => {
  it("generates a TOTP secret + otpauth URL and verifies a code generated from it", async () => {
    const mfa = new AdminMfaService();
    const secret = mfa.generateSecret();
    expect(secret.length).toBeGreaterThan(0);

    const url = mfa.buildOtpauthUrl("admin@wooriai.local", secret);
    expect(url).toContain("otpauth://totp/");
    expect(url).toContain("WooriAI%20Admin");

    const validCode = await generateTotp({ secret });
    expect(await mfa.verifyTotp(secret, validCode)).toBe(true);
    expect(await mfa.verifyTotp(secret, "000000")).toBe(false);
  });

  it("rejects malformed TOTP input (non-6-digit) without throwing", async () => {
    const mfa = new AdminMfaService();
    const secret = mfa.generateSecret();
    expect(await mfa.verifyTotp(secret, "")).toBe(false);
    expect(await mfa.verifyTotp(secret, "abcdef")).toBe(false);
    expect(await mfa.verifyTotp(secret, "12345")).toBe(false);
  });

  it("generates 10 unique recovery codes and consumes each exactly once, dash/case-insensitively", () => {
    const mfa = new AdminMfaService();
    const { plain, hashed } = mfa.generateRecoveryCodes();
    expect(plain).toHaveLength(10);
    expect(hashed).toHaveLength(10);
    expect(new Set(plain).size).toBe(10);

    // Matches regardless of dash formatting or case.
    const first = plain[0];
    const noDashLower = first.replace("-", "").toLowerCase();
    const { matched, remaining } = mfa.consumeRecoveryCode(hashed, noDashLower);
    expect(matched).toBe(true);
    expect(remaining).toHaveLength(9);

    // The consumed code no longer matches against the updated (remaining) list.
    const secondAttempt = mfa.consumeRecoveryCode(remaining, first);
    expect(secondAttempt.matched).toBe(false);
    expect(secondAttempt.remaining).toHaveLength(9);
  });

  it("rejects a recovery code that was never issued", () => {
    const mfa = new AdminMfaService();
    const { hashed } = mfa.generateRecoveryCodes();
    const { matched } = mfa.consumeRecoveryCode(hashed, "00000-00000");
    expect(matched).toBe(false);
  });

  it("locks out after 5 recorded failures and unlocks after resetting", async () => {
    const mfa = new AdminMfaService();
    const adminId = "admin-lockout-unit-test";

    for (let i = 0; i < 5; i += 1) {
      await expect(mfa.limiter.assertAllowed(adminId, "ADMIN_MFA_LOCKED", "locked")).resolves.toBeUndefined();
      await mfa.limiter.recordFailure(adminId);
    }
    await expect(mfa.limiter.assertAllowed(adminId, "ADMIN_MFA_LOCKED", "locked")).rejects.toThrow();

    await mfa.limiter.reset(adminId);
    await expect(mfa.limiter.assertAllowed(adminId, "ADMIN_MFA_LOCKED", "locked")).resolves.toBeUndefined();
    mfa.onModuleDestroy();
  });
});
