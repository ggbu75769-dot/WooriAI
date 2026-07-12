import { Injectable } from "@nestjs/common";

/**
 * In-memory revocation store for refresh token `jti` claims.
 *
 * Used to support single-use refresh token rotation: once a refresh token is used
 * (via /auth/refresh) or explicitly invalidated (via /auth/logout), its `jti` is
 * registered here so a later reuse attempt is rejected with 401.
 *
 * This is a prototype-grade in-memory store (no persistence, no cross-instance
 * sharing) — acceptable because the rest of the API is also in-memory today. Expired
 * entries are pruned lazily on access rather than via a background timer.
 */
@Injectable()
export class RefreshTokenRevocationService {
  private readonly revokedJtiExpiresAt = new Map<string, number>();

  revoke(jti: string, expiresAtEpochSeconds: number) {
    this.pruneExpired();
    this.revokedJtiExpiresAt.set(jti, expiresAtEpochSeconds);
  }

  isRevoked(jti: string): boolean {
    this.pruneExpired();
    return this.revokedJtiExpiresAt.has(jti);
  }

  private pruneExpired() {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, expiresAt] of this.revokedJtiExpiresAt) {
      if (expiresAt <= now) {
        this.revokedJtiExpiresAt.delete(jti);
      }
    }
  }
}
