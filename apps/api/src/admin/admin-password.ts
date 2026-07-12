import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt cost parameters. N must be a power of two; these values follow the
// generally-recommended interactive login baseline (~16-32MB memory cost).
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Hashes an admin password using scrypt. The stored format embeds the cost
 * parameters and salt so verification never has to guess them:
 *   scrypt:N:r:p:saltHex:hashHex
 */
export function hashAdminPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a hash produced by `hashAdminPassword`.
 * Uses a timing-safe comparison and never throws on malformed input (returns false).
 */
export function verifyAdminPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, salt, expected.length, { N, r, p });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
