import { afterEach, describe, expect, it } from "vitest";
import { DistributedAttemptLimiter } from "./distributed-attempt-limiter";

const originalNodeEnv = process.env.NODE_ENV;
const originalRedisUrl = process.env.REDIS_URL;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = originalRedisUrl;
});

describe("distributed attempt limiter", () => {
  it("uses a bounded local fallback only outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.REDIS_URL;
    const limiter = new DistributedAttemptLimiter("test", 2, 60_000);
    await limiter.recordFailure("person@example.com:127.0.0.1");
    await limiter.recordFailure("person@example.com:127.0.0.1");
    await expect(limiter.assertAllowed("person@example.com:127.0.0.1", "LOCKED", "locked")).rejects.toThrow();
    limiter.close();
  });

  it("fails closed in production when Redis protection is unavailable", async () => {
    process.env.NODE_ENV = "production";
    process.env.REDIS_URL = "redis://127.0.0.1:63999";
    const limiter = new DistributedAttemptLimiter("test", 2, 60_000);
    await expect(limiter.recordFailure("person@example.com:127.0.0.1")).rejects.toMatchObject({
      response: { code: "DISTRIBUTED_LOCK_UNAVAILABLE" },
      status: 503
    });
    limiter.close();
  });
});
