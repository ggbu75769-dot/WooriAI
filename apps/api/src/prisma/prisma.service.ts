import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Thin wrapper around PrismaClient with graceful lifecycle handling.
 *
 * The rest of the API is still in-memory today (domain data is migrated in a later
 * phase), so a missing/unreachable database must not prevent the app from booting.
 * `onModuleInit` attempts a connection but only logs a warning on failure instead of
 * throwing; `isConnected` reflects the current best-known state and is used by the
 * readiness endpoint. A lazy background retry keeps trying to connect so the app
 * recovers once the database becomes available, without blocking boot or any
 * in-memory domain functionality.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  async onModuleInit() {
    await this.tryConnect();
  }

  async onModuleDestroy() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.connected) {
      await this.$disconnect();
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Attempts a lightweight connectivity check (`SELECT 1`). Used by the readiness
   * endpoint so it reflects the live connection state rather than a stale flag.
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.connected = true;
      return true;
    } catch {
      this.connected = false;
      this.scheduleRetry();
      return false;
    }
  }

  private async tryConnect() {
    try {
      await this.$connect();
      this.connected = true;
    } catch (error) {
      this.connected = false;
      this.logger.warn(
        `Database connection failed at boot; continuing without it (in-memory domain features are unaffected). Reason: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      this.scheduleRetry();
    }
  }

  private scheduleRetry() {
    if (this.retryTimer) {
      return;
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.tryConnect();
    }, 15_000);
    this.retryTimer.unref?.();
  }
}
