import { createHash, randomBytes } from "node:crypto";
import { HttpException, HttpStatus, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { generate, generateSecret, generateURI, verify } from "otplib";
import { DistributedAttemptLimiter } from "../common/security/distributed-attempt-limiter";

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BYTES = 5; // 10 hex chars, formatted as XXXXX-XXXXX

const MFA_MAX_ATTEMPTS = 5;
const MFA_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

// One TOTP step (30s) of tolerance on either side of "now" to absorb small
// clock drift between the server and the admin's authenticator app, without
// widening the effective validity window enough to matter for brute force.
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function formatRecoveryCode(raw: string): string {
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

/** Strips whitespace/dashes and uppercases so "a1b2c-d3e4f", "A1B2CD3E4F", and
 * " a1b2c-d3e4f " all hash identically -- the dash is display-only formatting. */
function canonicalizeRecoveryCode(value: string): string {
  return value.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
}

@Injectable()
export class AdminMfaService implements OnModuleDestroy {
  readonly limiter = new DistributedAttemptLimiter("admin-mfa", MFA_MAX_ATTEMPTS, MFA_LOCKOUT_WINDOW_MS);

  onModuleDestroy() {
    this.limiter.close();
  }

  generateSecret(): string {
    return generateSecret();
  }

  buildOtpauthUrl(email: string, secret: string): string {
    return generateURI({ issuer: "WooriAI Admin", label: email, secret });
  }

  /** Used only by tests/tools that need a fresh valid code for a known secret. */
  async generateCode(secret: string): Promise<string> {
    return generate({ secret });
  }

  async verifyTotp(secret: string, token: string): Promise<boolean> {
    if (!token || !/^\d{6}$/.test(token)) {
      return false;
    }
    const result = await verify({ secret, token, epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS });
    return result.valid;
  }

  /**
   * Generates a fresh batch of 10 one-time recovery codes. Returns both the
   * plaintext (shown to the admin exactly once, by the caller) and the sha256
   * hashes to persist in `admin_users.mfa_recovery_codes`.
   */
  generateRecoveryCodes(): { plain: string[]; hashed: string[] } {
    const plain: string[] = [];
    const hashed: string[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
      const raw = randomBytes(RECOVERY_CODE_BYTES).toString("hex").toUpperCase();
      plain.push(formatRecoveryCode(raw));
      hashed.push(sha256Hex(raw));
    }
    return { plain, hashed };
  }

  /**
   * Checks `candidate` against the stored hash list. On a match, returns the
   * remaining hash list with that one code removed (one-time use) so the caller
   * can persist it back to `mfa_recovery_codes`.
   */
  consumeRecoveryCode(hashedCodes: string[], candidate: string): { matched: boolean; remaining: string[] } {
    const candidateHash = sha256Hex(canonicalizeRecoveryCode(candidate));
    const index = hashedCodes.findIndex((hash) => hash === candidateHash);
    if (index === -1) {
      return { matched: false, remaining: hashedCodes };
    }
    const remaining = [...hashedCodes.slice(0, index), ...hashedCodes.slice(index + 1)];
    return { matched: true, remaining };
  }
}
