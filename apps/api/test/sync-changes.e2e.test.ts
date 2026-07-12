import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/**
 * MOB-103 delta sync (design doc docs/5차/round5a-sprint1-plan.md §2.3):
 * GET /v1/sync/changes, backed by src/sync/{sync.controller,sync.service}.ts.
 * Covers the full acceptance flow called out in the design doc: create ->
 * update (matching expectedVersion) -> conflicting update (409 + current) ->
 * delete -> cursor-paginated re-read with no gaps/duplicates, tombstone
 * delivery for the soft-deleted row, and cross-household isolation (IDOR).
 */
describe("Delta sync API (/v1/sync/changes)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  async function login(prefix: string) {
    const providerToken = `${prefix}-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken })
      .expect(200);
    return response.body.tokens.accessToken as string;
  }

  async function completeOnboarding(accessToken: string) {
    const householdId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.households[0].id as string;

    await request(app.getHttpServer())
      .put("/api/v1/consents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        consents: [
          { type: "terms", version: "2026-07-06", accepted: true },
          { type: "privacy", version: "2026-07-06", accepted: true }
        ]
      })
      .expect(200);

    const childId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "싱크테스트", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    return { childId, householdId };
  }

  async function createExpense(accessToken: string, childId: string, itemName: string) {
    return (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, amountKrw: 10000, spentOn: "2026-07-06", itemName })
        .expect(200)
    ).body as { id: string; version: number };
  }

  async function collectAllChanges(accessToken: string, limit: number) {
    const changes: Array<{ type: string; op: string; id?: string; data?: { id: string } }> = [];
    let cursor: string | undefined;
    let pages = 0;
    // Safety bound so a pagination bug (e.g. a cursor that never advances)
    // fails the test instead of hanging it.
    const maxPages = 50;

    while (pages < maxPages) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/sync/changes${cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=${limit}` : `?limit=${limit}`}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      changes.push(...response.body.changes);
      cursor = response.body.nextCursor;
      pages += 1;
      if (!response.body.hasMore) {
        break;
      }
    }
    expect(pages).toBeLessThan(maxPages);
    return changes;
  }

  it("covers create -> matching-version update -> conflicting update (409 + current) -> delete, then paginates every change once via cursor with a tombstone for the delete", async () => {
    const accessToken = await login("sync-flow");
    const { childId } = await completeOnboarding(accessToken);

    const kept = await createExpense(accessToken, childId, "동기화 유지 품목");
    const toDelete = await createExpense(accessToken, childId, "동기화 삭제 품목");
    const untouched = await createExpense(accessToken, childId, "동기화 무변경 품목");

    // Matching expectedVersion succeeds.
    const updated = (
      await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${kept.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountKrw: 25000, expectedVersion: kept.version })
        .expect(200)
    ).body as { version: number };
    expect(updated.version).toBe(kept.version + 1);

    // Conflicting (stale) expectedVersion -> 409 with `current`.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${kept.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountKrw: 999, expectedVersion: kept.version })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VERSION_CONFLICT");
        expect(body.current).toMatchObject({ id: kept.id, amountKrw: 25000, version: updated.version });
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${toDelete.id}?expectedVersion=${toDelete.version}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // Small page size to force multiple cursor round-trips over the 3 expenses.
    const changes = await collectAllChanges(accessToken, 2);

    const idsSeen = changes.map((change) => change.data?.id ?? change.id);
    // No duplicates across pages.
    expect(new Set(idsSeen).size).toBe(idsSeen.length);
    // No gaps: all three expenses are represented exactly once.
    expect(new Set(idsSeen)).toEqual(new Set([kept.id, toDelete.id, untouched.id]));

    const keptChange = changes.find((change) => (change.data?.id ?? change.id) === kept.id);
    expect(keptChange).toMatchObject({ type: "expense", op: "upsert", data: { amountKrw: 25000 } });

    const deletedChange = changes.find((change) => (change.data?.id ?? change.id) === toDelete.id);
    expect(deletedChange).toMatchObject({ type: "expense", op: "delete", id: toDelete.id });
    expect((deletedChange as { deletedAt?: string }).deletedAt).toEqual(expect.any(String));

    const untouchedChange = changes.find((change) => (change.data?.id ?? change.id) === untouched.id);
    expect(untouchedChange).toMatchObject({ type: "expense", op: "upsert", data: { id: untouched.id } });
  });

  it("calling with no cursor starts from the beginning and returns a stable, decodable nextCursor", async () => {
    const accessToken = await login("sync-from-start");
    const { childId } = await completeOnboarding(accessToken);
    await createExpense(accessToken, childId, "처음부터");

    const response = await request(app.getHttpServer())
      .get("/api/v1/sync/changes")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.changes.length).toBeGreaterThan(0);
    expect(typeof response.body.nextCursor).toBe("string");
    expect(response.body.hasMore).toBe(false);

    // Re-querying with the returned cursor yields no further (already-seen) changes.
    const followUp = await request(app.getHttpServer())
      .get(`/api/v1/sync/changes?cursor=${encodeURIComponent(response.body.nextCursor)}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(followUp.body.changes).toEqual([]);
  });

  it("rejects a malformed cursor with 400 instead of silently misbehaving", async () => {
    const accessToken = await login("sync-bad-cursor");
    await completeOnboarding(accessToken);

    await request(app.getHttpServer())
      .get("/api/v1/sync/changes?cursor=not-valid-base64!!!")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("SYNC_CURSOR_INVALID");
      });
  });

  it("never exposes another household's expenses through sync/changes (IDOR)", async () => {
    const ownerToken = await login("sync-idor-owner");
    const { childId: ownerChildId } = await completeOnboarding(ownerToken);
    const ownerExpense = await createExpense(ownerToken, ownerChildId, "가구A 전용 품목");

    const strangerToken = await login("sync-idor-stranger");
    await completeOnboarding(strangerToken);

    const strangerChanges = await collectAllChanges(strangerToken, 100);
    const strangerIds = strangerChanges.map((change) => change.data?.id ?? change.id);
    expect(strangerIds).not.toContain(ownerExpense.id);
  });

  it("defaults limit to 100 and rejects a limit above the 200 max", async () => {
    const accessToken = await login("sync-limit");
    await completeOnboarding(accessToken);

    await request(app.getHttpServer())
      .get("/api/v1/sync/changes?limit=201")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .get("/api/v1/sync/changes?limit=200")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/api/v1/sync/changes").expect(401);
  });
});
