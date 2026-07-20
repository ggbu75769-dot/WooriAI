import { randomUUID } from "node:crypto";
import type { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { ContentRevisionsService } from "../src/admin/content-revisions.service";
import { JobProcessorService } from "../src/jobs/job-processor.service";
import { OutboxPublisherService } from "../src/jobs/outbox-publisher.service";
import { NotificationDeliveryService } from "../src/jobs/notification-delivery.service";
import { queueJobId, redisConnectionFromEnvironment, type JobQueue, type QueuedJobData } from "../src/jobs/queue";

function fakeJob(topic: string, dedupeKey: string, extra: Record<string, unknown> = {}): Job<QueuedJobData> {
  return {
    id: queueJobId(topic, dedupeKey),
    name: topic,
    data: {
      ...extra,
      __meta: { outboxId: randomUUID(), topic, dedupeKey, traceId: null, schemaVersion: 1 }
    },
    attemptsMade: 1,
    opts: { attempts: 1 }
  } as unknown as Job<QueuedJobData>;
}

describe("Release 3 outbox and worker contracts", () => {
  let context: INestApplicationContext;
  let prisma: PrismaClient;
  let publisher: OutboxPublisherService;
  let processor: JobProcessorService;
  let contentRevisions: ContentRevisionsService;
  let notificationDelivery: NotificationDeliveryService;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.PRIVACY_PROCESSOR_MODE = "mock";
    context = await NestFactory.createApplicationContext(AppModule, { logger: false });
    prisma = new PrismaClient();
    publisher = context.get(OutboxPublisherService);
    processor = context.get(JobProcessorService);
    contentRevisions = context.get(ContentRevisionsService);
    notificationDelivery = context.get(NotificationDeliveryService);
  });

  afterEach(async () => {
    await prisma.$disconnect();
    await context.close();
  });

  it("claims each outbox row once across concurrent publishers and uses a stable queue job id", async () => {
    await prisma.jobOutbox.deleteMany({ where: { aggregateType: "test", publishedAt: null } });
    const dedupeKey = randomUUID();
    await prisma.jobOutbox.create({
      data: {
        topic: "cleanup.oauth_transaction",
        aggregateType: "test",
        aggregateId: dedupeKey,
        dedupeKey,
        payloadJson: {},
        createdAt: new Date("1990-01-01T00:00:00.000Z")
      }
    });
    const [left, right] = await Promise.all([publisher.claimBatch(1), publisher.claimBatch(1)]);
    const claimed = [...left, ...right].filter((row) => row.dedupe_key === dedupeKey);
    expect(claimed).toHaveLength(1);
    expect(queueJobId("cleanup.oauth_transaction", dedupeKey)).toBe(queueJobId("cleanup.oauth_transaction", dedupeKey));
    await prisma.jobOutbox.deleteMany({ where: { dedupeKey } });
  });

  it("reclaims an abandoned lease once after restart without creating another logical event", async () => {
    const dedupeKey = randomUUID();
    const outbox = await prisma.jobOutbox.create({
      data: {
        topic: "cleanup.idempotency_key",
        aggregateType: "test",
        aggregateId: dedupeKey,
        dedupeKey,
        payloadJson: {},
        claimedAt: new Date(Date.now() - 10 * 60_000),
        claimExpiresAt: new Date(Date.now() - 5 * 60_000),
        attemptCount: 1,
        createdAt: new Date("1970-01-01T00:00:00.000Z")
      }
    });

    const batches = await Promise.all(Array.from({ length: 30 }, () => publisher.claimBatch(1)));
    const reclaimed = batches.flat().filter((row) => row.id === outbox.id);
    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0]?.attempt_count).toBe(2);
    expect(await prisma.jobOutbox.findUnique({ where: { id: outbox.id } })).toMatchObject({
      claimedBy: expect.any(String),
      claimExpiresAt: expect.any(Date)
    });
    expect(await prisma.jobOutbox.count({ where: { dedupeKey } })).toBe(1);

    await prisma.jobOutbox.delete({ where: { id: outbox.id } });
  });

  it("publishes once and marks the outbox row only after queue acceptance", async () => {
    const dedupeKey = randomUUID();
    const outbox = await prisma.jobOutbox.create({
      data: {
        topic: "cleanup.idempotency_key",
        aggregateType: "test",
        aggregateId: dedupeKey,
        dedupeKey,
        payloadJson: {},
        createdAt: new Date("1980-01-01T00:00:00.000Z")
      }
    });
    const added: string[] = [];
    const queue: JobQueue = {
      async add(_topic, _data, options) { added.push(options.jobId); }
    };
    expect(await publisher.publishBatch(queue, 1)).toMatchObject({ published: 1 });
    expect(added).toContain(queueJobId("cleanup.idempotency_key", dedupeKey));
    expect(await prisma.jobOutbox.findUnique({ where: { id: outbox.id } })).toMatchObject({ publishedAt: expect.any(Date) });
    await publisher.publishBatch(queue, 1);
    expect(added.filter((id) => id === queueJobId("cleanup.idempotency_key", dedupeKey))).toHaveLength(1);
  });

  it("dead-letters terminal jobs with a redacted payload and treats redelivery as a duplicate", async () => {
    const dedupeKey = randomUUID();
    const job = fakeJob("unknown.topic", dedupeKey, {
      userId: randomUUID(),
      email: "must-not-be-stored@example.com",
      accessToken: "must-not-be-stored"
    });
    expect(await processor.process(job)).toEqual({ code: "DEAD_LETTERED" });
    expect(await processor.process(job)).toEqual({ code: "DEAD_LETTERED", duplicate: true });
    const dlq = await prisma.deadLetterJob.findUnique({
      where: { topic_dedupeKey: { topic: "unknown.topic", dedupeKey } }
    });
    expect(dlq).toMatchObject({ failureCode: "JOB_TOPIC_UNKNOWN", attempts: 1 });
    expect(JSON.stringify(dlq?.payloadJson)).not.toContain("must-not-be-stored");
  });

  it("fails closed when production has no REDIS_URL", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousRedisUrl = process.env.REDIS_URL;
    process.env.NODE_ENV = "production";
    delete process.env.REDIS_URL;
    expect(() => redisConnectionFromEnvironment()).toThrow("REDIS_URL_REQUIRED");
    process.env.NODE_ENV = previousNodeEnv;
    if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousRedisUrl;
  });

  it("reconciles a provider-success acknowledgement loss without a second visible delivery", async () => {
    const user = await prisma.user.create({
      data: { authProvider: "kakao", providerUserId: `release4i-provider-ack-${randomUUID()}` }
    });
    try {
      for (let iteration = 0; iteration < 50; iteration += 1) {
        const delivery = await prisma.notificationDelivery.create({
          data: {
            userId: user.id,
            eventType: "release4i_provider_ack_loss",
            dedupeKey: `release4i-ack-loss-${randomUUID()}`,
            state: "sending",
            scheduledAt: new Date()
          }
        });
        await prisma.notificationDeliveryAttempt.create({
          data: {
            notificationDeliveryId: delivery.id,
            attemptNumber: 1,
            providerMode: "mock",
            providerIdempotencyKey: `notification:${randomUUID()}:1`,
            providerDeliveryId: null,
            state: "sending"
          }
        });

        await expect(notificationDelivery.reconcile(delivery.id)).resolves.toEqual({ code: "NOTIFICATION_SENT_MOCK_PROVIDER" });
        await expect(notificationDelivery.deliver(delivery.id)).resolves.toEqual({ code: "NOTIFICATION_ALREADY_FINAL" });
        expect(await prisma.notificationDeliveryAttempt.count({ where: { notificationDeliveryId: delivery.id } })).toBe(1);
        expect(await prisma.notificationDelivery.findUnique({ where: { id: delivery.id } })).toMatchObject({
          state: "sent",
          sentAt: expect.any(Date)
        });
        await prisma.notificationDelivery.delete({ where: { id: delivery.id } });
      }
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("publishes a due revision once across concurrent scheduler delivery", async () => {
    const admin = await prisma.adminUser.findFirst({ where: { role: "admin", disabledAt: null } });
    const editor = await prisma.adminUser.findFirst({ where: { role: "editor", disabledAt: null } });
    expect(admin).not.toBeNull();
    expect(editor).not.toBeNull();
    const key = `scheduled-${randomUUID()}`;
    const revision = await prisma.contentRevision.create({
      data: {
        entityType: "disclosure",
        entityId: null,
        revisionNo: 1,
        payload: { key, text: "예약 게시 테스트" },
        status: "in_review",
        authorAdminId: editor!.id,
        reviewerAdminId: admin!.id,
        submittedAt: new Date(Date.now() - 60_000),
        scheduledFor: new Date(Date.now() - 1000)
      }
    });
    const results = await Promise.allSettled([
      contentRevisions.publishDue(revision.id),
      contentRevisions.publishDue(revision.id)
    ]);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(0);
    expect(await prisma.contentRevision.findUnique({ where: { id: revision.id } })).toMatchObject({ status: "published" });
    expect(await prisma.disclosure.findUnique({ where: { key } })).toMatchObject({ text: "예약 게시 테스트" });
  });
});
