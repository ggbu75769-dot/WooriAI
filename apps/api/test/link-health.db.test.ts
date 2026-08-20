import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../src/prisma/prisma.service";
import {
  DEFAULT_LINK_HEALTH_BATCH,
  DEFAULT_LINK_HEALTH_INTERVAL_HOURS,
  LINK_HEALTH_MAX_REDIRECT_HOPS,
  LinkHealthJob,
  type LinkHealthFetch
} from "../src/worker/jobs/link-health.job";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

const HOUR_MS = 60 * 60 * 1000;

// COM-105: LinkHealthJob unit tests against the real test database with a
// mocked fetch — no network traffic ever leaves these tests. The job is
// constructed directly (constructor injection of the LINK_HEALTH_FETCH
// contract) instead of through Nest DI, mirroring how worker-jobs.db.test.ts
// drives run(now) without timers or the scheduler loop.
describe.skipIf(!dbAvailable)("LinkHealthJob (COM-105, real Postgres + mocked fetch)", () => {
  let prisma: PrismaClient;
  let itemTemplateId: string;
  const createdLinkIds: string[] = [];
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    deployMigrations();
    prisma = new PrismaClient();
    const item = await prisma.itemTemplate.create({
      data: {
        code: `link_health_test_${randomUUID().slice(0, 8)}`,
        name: "링크 헬스체크 테스트 준비템",
        necessityLevel: "optional",
        reasonText: "COM-105 테스트 전용",
        active: false
      }
    });
    itemTemplateId = item.id;
  });

  afterAll(async () => {
    await prisma.productLink.deleteMany({ where: { itemTemplateId } });
    await prisma.itemTemplate.delete({ where: { id: itemTemplateId } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    for (const key of ["LINK_HEALTH_ENABLED", "LINK_HEALTH_INTERVAL_HOURS", "LINK_HEALTH_BATCH"]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(async () => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await prisma.productLink.deleteMany({ where: { id: { in: createdLinkIds } } });
    createdLinkIds.length = 0;
  });

  async function createLink(overrides: {
    affiliateUrl?: string | null;
    active?: boolean;
    healthStatus?: string | null;
    healthCheckedAt?: Date | null;
  }): Promise<string> {
    const link = await prisma.productLink.create({
      data: {
        itemTemplateId,
        platform: "custom",
        title: `헬스체크 테스트 링크 ${randomUUID().slice(0, 8)}`,
        url: "https://example.com/product",
        affiliateUrl: overrides.affiliateUrl === undefined ? `https://example.com/aff/${randomUUID()}` : overrides.affiliateUrl,
        isAffiliate: true,
        active: overrides.active ?? true,
        healthStatus: overrides.healthStatus ?? null,
        healthCheckedAt: overrides.healthCheckedAt ?? null
      }
    });
    createdLinkIds.push(link.id);
    return link.id;
  }

  /**
   * The shared test database also holds seeded/e2e-created product links whose
   * healthCheckedAt is NULL; they would compete for the global batch slots.
   * Marking every link outside this test as freshly checked keeps candidate
   * selection deterministic (fileParallelism is off, so no other suite runs
   * concurrently while this one mutates them).
   */
  async function quarantineOtherLinks(now: Date): Promise<void> {
    await prisma.productLink.updateMany({
      where: { id: { notIn: createdLinkIds } },
      data: { healthStatus: "ok", healthCheckedAt: now }
    });
  }

  function response(status: number, headers?: Record<string, string>): Response {
    return new Response(null, { status, headers });
  }

  type Handler = (method: "HEAD" | "GET", url: string) => Response | Promise<Response>;
  function mockFetch(handler: Handler) {
    const calls: { url: string; method: "HEAD" | "GET" }[] = [];
    const fetchFn: LinkHealthFetch = vi.fn(async (url, init) => {
      expect(init.redirect).toBe("manual");
      expect(init.signal).toBeInstanceOf(AbortSignal);
      calls.push({ url, method: init.method });
      return await handler(init.method, url);
    });
    return { fetchFn, calls };
  }

  function jobWith(fetchFn: LinkHealthFetch): LinkHealthJob {
    return new LinkHealthJob(prisma as unknown as PrismaService, fetchFn);
  }

  async function healthOf(id: string) {
    return await prisma.productLink.findUniqueOrThrow({
      where: { id },
      select: { healthStatus: true, healthCheckedAt: true }
    });
  }

  it("is disabled by default: no probes and no writes unless LINK_HEALTH_ENABLED=1", async () => {
    const now = new Date();
    const staleId = await createLink({ healthCheckedAt: null });
    const { fetchFn } = mockFetch(() => response(200));

    const result = await jobWith(fetchFn).run(now);

    expect(result).toEqual({ enabled: false, checked: 0 });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(await healthOf(staleId)).toEqual({ healthStatus: null, healthCheckedAt: null });
  });

  it("maps 2xx→ok, 4xx→broken, 5xx→unstable, network error→unstable and stamps healthCheckedAt=now", async () => {
    process.env.LINK_HEALTH_ENABLED = "1";
    const now = new Date();
    const okId = await createLink({ affiliateUrl: "https://shop.example/ok" });
    const brokenId = await createLink({ affiliateUrl: "https://shop.example/gone" });
    const serverErrorId = await createLink({ affiliateUrl: "https://shop.example/boom" });
    const networkErrorId = await createLink({ affiliateUrl: "https://down.example/x" });
    await quarantineOtherLinks(now);

    const { fetchFn } = mockFetch((_method, url) => {
      if (url.endsWith("/ok")) return response(200);
      if (url.endsWith("/gone")) return response(404);
      if (url.endsWith("/boom")) return response(503);
      throw new TypeError("fetch failed"); // DNS/connection failure
    });

    const result = await jobWith(fetchFn).run(now);

    expect(result).toMatchObject({ enabled: true, checked: 4, ok: 1, broken: 1, unstable: 2, errors: 0 });
    expect(await healthOf(okId)).toEqual({ healthStatus: "ok", healthCheckedAt: now });
    expect(await healthOf(brokenId)).toEqual({ healthStatus: "broken", healthCheckedAt: now });
    expect(await healthOf(serverErrorId)).toEqual({ healthStatus: "unstable", healthCheckedAt: now });
    expect(await healthOf(networkErrorId)).toEqual({ healthStatus: "unstable", healthCheckedAt: now });
  });

  it("falls back to GET on the same URL when HEAD is answered with 405", async () => {
    process.env.LINK_HEALTH_ENABLED = "1";
    const now = new Date();
    const id = await createLink({ affiliateUrl: "https://no-head.example/p" });
    await quarantineOtherLinks(now);

    const { fetchFn, calls } = mockFetch((method) => (method === "HEAD" ? response(405) : response(200)));
    await jobWith(fetchFn).run(now);

    expect((await healthOf(id)).healthStatus).toBe("ok");
    expect(calls).toEqual([
      { url: "https://no-head.example/p", method: "HEAD" },
      { url: "https://no-head.example/p", method: "GET" }
    ]);
  });

  it("follows redirects (relative Location included) to the final verdict, but flags loops beyond 5 hops as broken", async () => {
    process.env.LINK_HEALTH_ENABLED = "1";
    const now = new Date();
    const chainOkId = await createLink({ affiliateUrl: "https://chain.example/start" });
    const chainDeadId = await createLink({ affiliateUrl: "https://chain.example/dead-start" });
    const loopId = await createLink({ affiliateUrl: "https://loop.example/a" });
    await quarantineOtherLinks(now);

    const { fetchFn, calls } = mockFetch((_method, url) => {
      if (url === "https://chain.example/start") return response(302, { location: "/step2" });
      if (url === "https://chain.example/step2") return response(301, { location: "https://final.example/p" });
      if (url === "https://final.example/p") return response(200);
      if (url === "https://chain.example/dead-start") return response(302, { location: "https://final.example/removed" });
      if (url === "https://final.example/removed") return response(410); // redirect-broken: chain ends 4xx
      return response(302, { location: "https://loop.example/a" }); // self-loop
    });

    await jobWith(fetchFn).run(now);

    expect((await healthOf(chainOkId)).healthStatus).toBe("ok");
    expect((await healthOf(chainDeadId)).healthStatus).toBe("broken");
    expect((await healthOf(loopId)).healthStatus).toBe("broken");
    // The loop is abandoned after the max hop count, never followed further.
    const loopRequests = calls.filter((call) => call.url === "https://loop.example/a");
    expect(loopRequests).toHaveLength(LINK_HEALTH_MAX_REDIRECT_HOPS + 1);
  });

  it("checks at most LINK_HEALTH_BATCH links per tick, oldest checked first", async () => {
    process.env.LINK_HEALTH_ENABLED = "1";
    process.env.LINK_HEALTH_BATCH = "2";
    const now = new Date();
    const oldest = await createLink({ healthStatus: "ok", healthCheckedAt: new Date(now.getTime() - 72 * HOUR_MS) });
    const older = await createLink({ healthStatus: "ok", healthCheckedAt: new Date(now.getTime() - 48 * HOUR_MS) });
    const newestStale = await createLink({ healthStatus: "ok", healthCheckedAt: new Date(now.getTime() - 30 * HOUR_MS) });
    await quarantineOtherLinks(now);

    const { fetchFn } = mockFetch(() => response(404));
    const result = await jobWith(fetchFn).run(now);

    expect(result).toMatchObject({ checked: 2, batch: 2 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect((await healthOf(oldest)).healthStatus).toBe("broken");
    expect((await healthOf(older)).healthStatus).toBe("broken");
    // The least-stale link waits for the next tick — the cap bounds tick duration.
    expect((await healthOf(newestStale)).healthStatus).toBe("ok");
  });

  it("re-checks only links unchecked or older than LINK_HEALTH_INTERVAL_HOURS, retries unstable next round, and skips inactive/no-affiliate-url links", async () => {
    process.env.LINK_HEALTH_ENABLED = "1";
    const now = new Date();
    const neverChecked = await createLink({});
    const staleOk = await createLink({ healthStatus: "ok", healthCheckedAt: new Date(now.getTime() - 25 * HOUR_MS) });
    const freshOk = await createLink({ healthStatus: "ok", healthCheckedAt: new Date(now.getTime() - HOUR_MS) });
    const freshUnstable = await createLink({ healthStatus: "unstable", healthCheckedAt: new Date(now.getTime() - HOUR_MS) });
    const noAffiliateUrl = await createLink({ affiliateUrl: null });
    const inactive = await createLink({ active: false });
    await quarantineOtherLinks(now);

    const { fetchFn } = mockFetch(() => response(200));
    const result = await jobWith(fetchFn).run(now);

    expect(result).toMatchObject({ checked: 3, intervalHours: DEFAULT_LINK_HEALTH_INTERVAL_HOURS });
    expect((await healthOf(neverChecked)).healthStatus).toBe("ok");
    expect((await healthOf(staleOk)).healthCheckedAt).toEqual(now);
    // Within the interval and healthy — untouched.
    expect((await healthOf(freshOk)).healthCheckedAt).not.toEqual(now);
    // Transient verdicts don't wait out the interval.
    expect(await healthOf(freshUnstable)).toEqual({ healthStatus: "ok", healthCheckedAt: now });
    expect(await healthOf(noAffiliateUrl)).toEqual({ healthStatus: null, healthCheckedAt: null });
    expect(await healthOf(inactive)).toEqual({ healthStatus: null, healthCheckedAt: null });
  });

  it("honors a custom LINK_HEALTH_INTERVAL_HOURS", async () => {
    process.env.LINK_HEALTH_ENABLED = "1";
    process.env.LINK_HEALTH_INTERVAL_HOURS = "48";
    const now = new Date();
    const withinWiderInterval = await createLink({ healthStatus: "ok", healthCheckedAt: new Date(now.getTime() - 30 * HOUR_MS) });
    const beyondWiderInterval = await createLink({ healthStatus: "ok", healthCheckedAt: new Date(now.getTime() - 49 * HOUR_MS) });
    await quarantineOtherLinks(now);

    const { fetchFn } = mockFetch(() => response(200));
    const result = await jobWith(fetchFn).run(now);

    expect(result).toMatchObject({ checked: 1, intervalHours: 48 });
    expect((await healthOf(withinWiderInterval)).healthCheckedAt).not.toEqual(now);
    expect((await healthOf(beyondWiderInterval)).healthCheckedAt).toEqual(now);
  });

  it("isolates per-link failures: run() resolves and the remaining links are still checked", async () => {
    process.env.LINK_HEALTH_ENABLED = "1";
    const now = new Date();
    const disappearingId = await createLink({ affiliateUrl: "https://race.example/deleted-mid-check" });
    const survivorId = await createLink({ affiliateUrl: "https://race.example/fine" });
    await quarantineOtherLinks(now);

    // The row vanishes while its probe is in flight, so the job's own DB write
    // (`update`) throws — the batch must carry on regardless.
    const { fetchFn } = mockFetch(async (_method, url) => {
      if (url.endsWith("/deleted-mid-check")) {
        await prisma.productLink.delete({ where: { id: disappearingId } });
        return response(200);
      }
      return response(200);
    });

    const result = await jobWith(fetchFn).run(now);

    expect(result).toMatchObject({ checked: 2, errors: 1 });
    expect(await healthOf(survivorId)).toEqual({ healthStatus: "ok", healthCheckedAt: now });
  });

  it("parses env with defaults: enabled only on the literal \"1\", 24h interval, batch 10", () => {
    expect(LinkHealthJob.isEnabled({})).toBe(false);
    expect(LinkHealthJob.isEnabled({ LINK_HEALTH_ENABLED: "0" })).toBe(false);
    expect(LinkHealthJob.isEnabled({ LINK_HEALTH_ENABLED: "true" })).toBe(false);
    expect(LinkHealthJob.isEnabled({ LINK_HEALTH_ENABLED: "1" })).toBe(true);

    expect(LinkHealthJob.intervalHours({})).toBe(DEFAULT_LINK_HEALTH_INTERVAL_HOURS);
    expect(LinkHealthJob.intervalHours({ LINK_HEALTH_INTERVAL_HOURS: "abc" })).toBe(DEFAULT_LINK_HEALTH_INTERVAL_HOURS);
    expect(LinkHealthJob.intervalHours({ LINK_HEALTH_INTERVAL_HOURS: "-3" })).toBe(DEFAULT_LINK_HEALTH_INTERVAL_HOURS);
    expect(LinkHealthJob.intervalHours({ LINK_HEALTH_INTERVAL_HOURS: "6" })).toBe(6);

    expect(LinkHealthJob.batchSize({})).toBe(DEFAULT_LINK_HEALTH_BATCH);
    expect(LinkHealthJob.batchSize({ LINK_HEALTH_BATCH: "abc" })).toBe(DEFAULT_LINK_HEALTH_BATCH);
    expect(LinkHealthJob.batchSize({ LINK_HEALTH_BATCH: "0" })).toBe(DEFAULT_LINK_HEALTH_BATCH);
    expect(LinkHealthJob.batchSize({ LINK_HEALTH_BATCH: "3" })).toBe(3);
  });

  it("migration 000009 applied cleanly: product_links has nullable health_status varchar(16) and health_checked_at timestamptz", async () => {
    const columns = await prisma.$queryRaw<
      { column_name: string; data_type: string; is_nullable: string; character_maximum_length: number | null }[]
    >`SELECT column_name, data_type, is_nullable, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'product_links' AND column_name IN ('health_status', 'health_checked_at')
      ORDER BY column_name`;

    expect(columns).toEqual([
      {
        column_name: "health_checked_at",
        data_type: "timestamp with time zone",
        is_nullable: "YES",
        character_maximum_length: null
      },
      {
        column_name: "health_status",
        data_type: "character varying",
        is_nullable: "YES",
        character_maximum_length: 16
      }
    ]);
  });
});
