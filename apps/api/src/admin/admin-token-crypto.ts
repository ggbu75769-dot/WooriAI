import { createHmac, timingSafeEqual } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import type { AdminRole } from "@prisma/client";
import { requireSecret } from "../common/config/require-secret";

/** Admin access tokens are short-lived (1 hour) compared to end-user access tokens. */
export const ADMIN_ACCESS_TOKEN_TTL_SECONDS = 3600;

export type AdminAccessTokenPayload = {
  type: "admin_access";
  adminId: string;
  role: AdminRole;
  iat: number;
  exp: number;
};

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function hmacSha256(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function accessSecret() {
  // Deliberately reuses JWT_ACCESS_SECRET (see task spec) rather than introducing a
  // separate admin-only secret; the `type: "admin_access"` claim keeps admin tokens
  // from being accepted by the end-user JwtAuthGuard and vice versa.
  return requireSecret("JWT_ACCESS_SECRET", "wooriai-dev-access-secret");
}

export function signAdminAccessToken(params: { adminId: string; role: AdminRole }): {
  token: string;
  expiresIn: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson({
    type: "admin_access",
    adminId: params.adminId,
    role: params.role,
    iat: now,
    exp: now + ADMIN_ACCESS_TOKEN_TTL_SECONDS
  } satisfies AdminAccessTokenPayload);
  const signingInput = `${header}.${payload}`;
  return {
    token: `${signingInput}.${hmacSha256(signingInput, accessSecret())}`,
    expiresIn: ADMIN_ACCESS_TOKEN_TTL_SECONDS
  };
}

export function verifyAdminAccessToken(token: string): AdminAccessTokenPayload {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    throw new UnauthorizedException({ code: "ADMIN_UNAUTHORIZED", message: "Admin access is required." });
  }

  const signingInput = `${header}.${payload}`;
  if (!safeCompare(signature, hmacSha256(signingInput, accessSecret()))) {
    throw new UnauthorizedException({ code: "ADMIN_UNAUTHORIZED", message: "Admin access is required." });
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminAccessTokenPayload;
  const now = Math.floor(Date.now() / 1000);
  if (parsed.type !== "admin_access" || parsed.exp <= now) {
    throw new UnauthorizedException({ code: "ADMIN_UNAUTHORIZED", message: "Admin access is required." });
  }

  return parsed;
}

/**
 * SEC-101 §8 "택1" for the password->TOTP intermediate step: a short-lived signed
 * token (not a DB-backed pending session row) carried by the client between
 * POST /admin/auth/login and POST /admin/auth/mfa/verify-login. Stateless by
 * design -- admin_sessions has no "pending" state column to add (schema/migration
 * changes are out of scope for this task), and a signed token needs no cleanup
 * job for abandoned logins the way a DB row would.
 */
export const ADMIN_MFA_PENDING_TOKEN_TTL_SECONDS = 5 * 60;

export type AdminMfaPendingTokenPayload = {
  type: "admin_mfa_pending";
  adminId: string;
  iat: number;
  exp: number;
};

export function signAdminMfaPendingToken(params: { adminId: string }): { token: string; expiresIn: number } {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson({
    type: "admin_mfa_pending",
    adminId: params.adminId,
    iat: now,
    exp: now + ADMIN_MFA_PENDING_TOKEN_TTL_SECONDS
  } satisfies AdminMfaPendingTokenPayload);
  const signingInput = `${header}.${payload}`;
  return {
    token: `${signingInput}.${hmacSha256(signingInput, accessSecret())}`,
    expiresIn: ADMIN_MFA_PENDING_TOKEN_TTL_SECONDS
  };
}

export function verifyAdminMfaPendingToken(token: string): AdminMfaPendingTokenPayload {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    throw new UnauthorizedException({ code: "ADMIN_MFA_TOKEN_INVALID", message: "다시 로그인해주세요." });
  }

  const signingInput = `${header}.${payload}`;
  if (!safeCompare(signature, hmacSha256(signingInput, accessSecret()))) {
    throw new UnauthorizedException({ code: "ADMIN_MFA_TOKEN_INVALID", message: "다시 로그인해주세요." });
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminMfaPendingTokenPayload;
  const now = Math.floor(Date.now() / 1000);
  if (parsed.type !== "admin_mfa_pending" || parsed.exp <= now) {
    throw new UnauthorizedException({ code: "ADMIN_MFA_TOKEN_INVALID", message: "다시 로그인해주세요." });
  }

  return parsed;
}
