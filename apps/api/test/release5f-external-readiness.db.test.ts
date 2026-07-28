import { Test, type TestingModule } from "@nestjs/testing";
import { createHmac, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { recallSigningPayload, Release5ExternalService } from "../src/release5/release5-external.service";
import type { RecallProviderEventDto } from "../src/release5/dto/release5-external.dto";

describe("Release 5F external integration readiness", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let external: Release5ExternalService;
  const adminIds: string[] = [];
  const recallIds: string[] = [];
  const feedIds: string[] = [];

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.RELEASE5_INTERNAL_FEATURES = "1";
    process.env.RECALL_PROVIDER_WEBHOOK_SECRET = "release5-recall-test-secret";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    external = moduleRef.get(Release5ExternalService);
  });

  afterEach(async () => {
    if (feedIds.length) await prisma.merchantFeedImport.deleteMany({ where: { id: { in: feedIds.splice(0) } } });
    if (recallIds.length) await prisma.recallProviderEvent.deleteMany({ where: { id: { in: recallIds.splice(0) } } });
    if (adminIds.length) await prisma.adminUser.deleteMany({ where: { id: { in: adminIds.splice(0) } } });
    delete process.env.RELEASE5_INTERNAL_FEATURES;
    delete process.env.RECALL_PROVIDER_WEBHOOK_SECRET;
    await moduleRef.close();
  });

  async function admins() {
    const created = await Promise.all(["importer", "reviewer", "publisher"].map((label) => prisma.adminUser.create({
      data: { email: `release5f-${label}-${randomUUID()}@wooriai.test`, passwordHash: "test-only", displayName: label, role: "admin" }
    })));
    adminIds.push(...created.map((entry) => entry.id));
    return created;
  }

  function signed(input: Omit<RecallProviderEventDto, "signature">): RecallProviderEventDto {
    return {
      ...input,
      signature: createHmac("sha256", process.env.RECALL_PROVIDER_WEBHOOK_SECRET!).update(recallSigningPayload(input)).digest("hex")
    };
  }

  it("deduplicates recall delivery, rejects conflicting versions, and never treats unknown as safe", async () => {
    const [reviewer] = await admins();
    const item = await prisma.itemDefinition.findFirstOrThrow({ orderBy: { id: "asc" } });
    const unsigned = {
      providerKey: "release5_sandbox",
      eventId: `recall-${randomUUID()}`,
      eventVersion: 1,
      status: "recalled" as const,
      canonicalItemId: item.id,
      title: "Provider recall fixture",
      guidance: "Stop use and check the official notice.",
      sourceUrl: "https://www.wooriai.kr/recall-fixture",
      occurredAt: "2026-07-17T09:00:00.000Z",
      payload: { lot: "R5" }
    };
    await expect(external.ingestRecall({ ...signed(unsigned), signature: "0".repeat(64) }))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "RECALL_SIGNATURE_INVALID" }) });

    let firstId = "";
    for (let repeat = 0; repeat < 30; repeat += 1) {
      const result = await external.ingestRecall(signed(unsigned));
      firstId ||= result.event.id;
      expect(result.event.id).toBe(firstId);
      expect(result.duplicate).toBe(repeat > 0);
    }
    recallIds.push(firstId);
    expect(await prisma.recallProviderEvent.count({ where: { providerKey: unsigned.providerKey, providerEventId: unsigned.eventId } })).toBe(1);
    const conflicting = { ...unsigned, guidance: "Changed content without a new provider version." };
    await expect(external.ingestRecall(signed(conflicting))).rejects.toMatchObject({ response: expect.objectContaining({ code: "RECALL_EVENT_VERSION_CONFLICT" }) });

    const reviewed = await external.reviewRecall(reviewer!.id, firstId, { decision: "approve", expectedVersion: 1 });
    expect(reviewed).toMatchObject({ reviewState: "approved", eventStatus: "recalled", version: 2 });

    const unknownUnsigned = { ...unsigned, eventId: `unknown-${randomUUID()}`, status: "unknown" as const };
    const unknown = await external.ingestRecall(signed(unknownUnsigned));
    recallIds.push(unknown.event.id);
    await expect(external.reviewRecall(reviewer!.id, unknown.event.id, { decision: "approve", expectedVersion: 1 }))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "RECALL_UNKNOWN_NOT_SAFE" }) });
  });

  it("previews malformed merchant rows without offers and enforces operator separation", async () => {
    const [importer, reviewer] = await admins();
    const item = await prisma.itemDefinition.findFirstOrThrow({ where: { status: "in_review" }, orderBy: { id: "asc" } });
    const offersBefore = await prisma.productOffer.count();
    const publishedBefore = await prisma.itemDefinition.count({ where: { status: "published" } });
    const checkedAt = new Date().toISOString();
    const input = {
      sourceName: `Release 5 feed ${randomUUID()}`,
      rows: [
        { merchantIdentity: "merchant.safe", itemDefinitionId: item.id, productName: "Candidate", publicUrl: "https://merchant.wooriai.kr/item", priceKrw: 42_000, currency: "KRW", stockState: "in_stock" as const, shipping: { feeKrw: 0 }, affiliate: true, disclosureText: "구매 시 수수료를 받을 수 있어요.", priceCheckedAt: checkedAt },
        { merchantIdentity: "merchant.bad", itemDefinitionId: item.id, productName: "Blocked", publicUrl: "https://127.0.0.1/item", priceKrw: -1, currency: "USD", stockState: "unknown" as const, affiliate: true, priceCheckedAt: checkedAt }
      ]
    };
    const preview = await external.previewMerchantFeed(importer!.id, input);
    feedIds.push(preview.import.id);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0]).toMatchObject({ validationState: "valid", reviewState: "pending" });
    expect(preview.rows[1]).toMatchObject({ validationState: "invalid" });
    expect(preview.rows[1]!.validationErrors).toEqual(expect.arrayContaining(["PUBLIC_URL_BLOCKED", "PRICE_INVALID", "CURRENCY_UNSUPPORTED", "AFFILIATE_DISCLOSURE_REQUIRED"]));
    const duplicate = await external.previewMerchantFeed(importer!.id, input);
    expect(duplicate).toMatchObject({ duplicate: true, import: { id: preview.import.id } });

    await expect(external.reviewMerchantRow(importer!.id, preview.rows[0]!.id, { decision: "approve" }))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "MERCHANT_FEED_SELF_REVIEW_FORBIDDEN" }) });
    await expect(external.reviewMerchantRow(reviewer!.id, preview.rows[1]!.id, { decision: "approve" }))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "MERCHANT_FEED_ROW_INVALID" }) });
    const approved = await external.reviewMerchantRow(reviewer!.id, preview.rows[0]!.id, { decision: "approve" });
    expect(approved.reviewState).toBe("approved");
    await expect(external.publishMerchantRow(importer!.id, approved.id))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "MERCHANT_FEED_PUBLISHER_SEPARATION_REQUIRED" }) });
    expect(await prisma.productOffer.count()).toBe(offersBefore);
    expect(await prisma.itemDefinition.count({ where: { status: "published" } })).toBe(publishedBefore);
  });
});
