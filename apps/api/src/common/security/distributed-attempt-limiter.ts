import { createHmac } from "node:crypto";
import { HttpException, HttpStatus } from "@nestjs/common";
import Redis from "ioredis";

type LocalAttempt = { count: number; expiresAt: number };

export class DistributedAttemptLimiter {
  private readonly local = new Map<string, LocalAttempt>();
  private readonly redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null
      })
    : null;

  constructor(private readonly namespace: string, private readonly max: number, private readonly windowMs: number) {
    this.redis?.on("error", () => undefined);
  }

  async assertAllowed(rawIdentity: string, code: string, message: string): Promise<void> {
    if ((await this.read(rawIdentity)) >= this.max) {
      throw new HttpException({ code, message }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async recordFailure(rawIdentity: string): Promise<boolean> {
    return (await this.increment(rawIdentity)) >= this.max;
  }

  async reset(rawIdentity: string): Promise<void> {
    const key = this.key(rawIdentity);
    if (this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch (error) {
        this.handleUnavailable(error);
      }
    }
    this.local.delete(key);
  }

  close(): void {
    this.redis?.disconnect(false);
  }

  private key(rawIdentity: string): string {
    const salt = process.env.RATE_LIMIT_KEY_SALT ?? "wooriai-dev-rate-limit-salt";
    const digest = createHmac("sha256", salt).update(rawIdentity).digest("hex");
    return `attempt:${this.namespace}:${digest}`;
  }

  private async read(rawIdentity: string): Promise<number> {
    const key = this.key(rawIdentity);
    if (this.redis) {
      try {
        return Number((await this.redis.get(key)) ?? 0);
      } catch (error) {
        this.handleUnavailable(error);
      }
    }
    const current = this.local.get(key);
    if (!current || current.expiresAt <= Date.now()) {
      this.local.delete(key);
      return 0;
    }
    return current.count;
  }

  private async increment(rawIdentity: string): Promise<number> {
    const key = this.key(rawIdentity);
    if (this.redis) {
      try {
        return Number(await this.redis.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return n",
          1,
          key,
          String(this.windowMs)
        ));
      } catch (error) {
        this.handleUnavailable(error);
      }
    }
    const now = Date.now();
    const current = this.local.get(key);
    const next = !current || current.expiresAt <= now
      ? { count: 1, expiresAt: now + this.windowMs }
      : { ...current, count: current.count + 1 };
    this.local.set(key, next);
    return next.count;
  }

  private handleUnavailable(error: unknown): never | void {
    if (process.env.NODE_ENV === "production") {
      throw new HttpException(
        { code: "DISTRIBUTED_LOCK_UNAVAILABLE", message: "보호 기능을 확인할 수 없어 요청을 처리할 수 없습니다." },
        HttpStatus.SERVICE_UNAVAILABLE,
        { cause: error }
      );
    }
  }
}
