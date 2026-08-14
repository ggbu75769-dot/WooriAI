import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { generate as generateTotp } from "otplib";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { ScheduledPublishJob } from "../src/worker/jobs/scheduled-publish.job";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

// COM-103 (round5a-sprint2-plan.md §3): CMS draft -> review -> publish workflow.
// Mirrors admin-rbac.db.test.ts's cookie-session + MFA-enrollment login pattern
// (real Postgres required) since the content-revisions endpoints sit behind the
// same AdminAuthGuard/RBAC as the rest of /admin/*.
describe.skipIf(!dbAvailable)("Admin content revisions (COM-103, real Postgres)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let scheduledPublishJob: ScheduledPublishJob;

  beforeAll(async () => {
    deployMigrations();
    prisma = new PrismaClient();

    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_ADMIN_TOKEN = "test-legacy-admin-token";
    // This suite makes 3 auth-path requests per loginAndEnroll (login + MFA
    // setup start/verify) across many accounts; the COM-103b tests pushed it
    // past the default 30/min per-IP auth ceiling (SEC rate-limit middleware
    // reads this env on every request, so a suite-local override is safe).
    process.env.RATE_LIMIT_AUTH_MAX = "200";
    // COM-103b: the scheduled-publish tests below drive the worker job's run()
    // directly (like worker-jobs.db.test.ts); the scheduler loop must stay
    // env-gated off.
    delete process.env.WORKER_ENABLED;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();

    scheduledPublishJob = moduleRef.get(ScheduledPublishJob, { strict: false });
  });

  afterAll(async () => {
    delete process.env.RATE_LIMIT_AUTH_MAX;
    await app.close();
    await prisma.$disconnect();
  });

  async function createAdmin(email: string, password: string, role: "admin" | "editor" | "analyst") {
    return prisma.adminUser.upsert({
      where: { email },
      update: {
        passwordHash: hashAdminPassword(password),
        role,
        active: true,
        totpSecret: null,
        mfaEnabledAt: null,
        mfaRecoveryCodes: []
      },
      create: {
        email,
        passwordHash: hashAdminPassword(password),
        displayName: email,
        role,
        active: true
      }
    });
  }

  function parseSetCookies(response: request.Response): Record<string, string> {
    const raw = response.headers["set-cookie"];
    const setCookieHeaders: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const cookies: Record<string, string> = {};
    for (const header of setCookieHeaders) {
      const [pair] = header.split(";");
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) continue;
      cookies[pair.slice(0, separatorIndex).trim()] = pair.slice(separatorIndex + 1).trim();
    }
    return cookies;
  }

  function cookieHeader(cookies: Record<string, string>): string {
    return Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async function loginAndEnroll(email: string, password: string): Promise<{ cookie: string; csrfToken: string }> {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password })
      .expect(200);
    expect(loginResponse.body.mfaRequired).toBe(false);

    let cookies = parseSetCookies(loginResponse);
    let cookie = cookieHeader(cookies);
    let csrfToken = cookies.admin_csrf;

    const setupStart = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/start")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .expect(200);
    const secret = setupStart.body.secret as string;
    const code = await generateTotp({ secret });

    const setupVerify = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ code })
      .expect(200);
    expect(Array.isArray(setupVerify.body.recoveryCodes)).toBe(true);

    cookies = { ...cookies, ...parseSetCookies(setupVerify) };
    cookie = cookieHeader(cookies);
    csrfToken = cookies.admin_csrf;

    return { cookie, csrfToken };
  }

  it("takes an editor draft through submit -> admin approve-publish -> live reflection, blocks editor direct writes and self-approval, supports reject and rollback", async () => {
    await createAdmin("cr-editor@wooriai.local", "editor-password-1", "editor");
    await createAdmin("cr-admin-1@wooriai.local", "admin-password-1", "admin");
    await createAdmin("cr-admin-2@wooriai.local", "admin-password-2", "admin");

    const editor = await loginAndEnroll("cr-editor@wooriai.local", "editor-password-1");
    const admin1 = await loginAndEnroll("cr-admin-1@wooriai.local", "admin-password-1");
    const admin2 = await loginAndEnroll("cr-admin-2@wooriai.local", "admin-password-2");

    // 1) Editor drafts a brand-new item template (entityId omitted).
    const draft = await request(app.getHttpServer())
      .post("/api/v1/admin/content-revisions")
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({
        entityType: "item_template",
        payload: {
          name: "Content revision draft item",
          necessityLevel: "essential",
          reasonText: "Drafted via COM-103 e2e."
        }
      })
      .expect(200);
    expect(draft.body).toMatchObject({ status: "draft", entityType: "item_template", entityId: null, revisionNo: 1 });
    const revisionId = draft.body.id as string;

    // 2) Editor can edit their own draft in place (no new revision row created).
    const edited = await request(app.getHttpServer())
      .patch(`/api/v1/admin/content-revisions/${revisionId}`)
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({
        payload: {
          name: "Content revision draft item (edited)",
          necessityLevel: "essential",
          reasonText: "Drafted via COM-103 e2e, then edited."
        }
      })
      .expect(200);
    expect(edited.body.id).toBe(revisionId);
    expect(edited.body.payload.name).toBe("Content revision draft item (edited)");

    // 3) Editor is blocked from the direct-write endpoint -- must go through
    //    the revision flow (COM-103 requirement #2).
    await request(app.getHttpServer())
      .post("/api/v1/admin/item-templates")
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({ name: "Editor direct create", necessityLevel: "essential", reasonText: "Should be forbidden." })
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));

    // 4) Submit for review.
    const submitted = await request(app.getHttpServer())
      .post(`/api/v1/admin/content-revisions/${revisionId}/submit`)
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .expect(200);
    expect(submitted.body.status).toBe("in_review");

    // 5) GET single revision includes a live snapshot for diffing -- entity
    //    doesn't exist live yet, so it must be null.
    const beforePublish = await request(app.getHttpServer())
      .get(`/api/v1/admin/content-revisions/${revisionId}`)
      .set("Cookie", admin1.cookie)
      .expect(200);
    expect(beforePublish.body.live).toBeNull();

    // 6) Approve-publish with a *different* admin reflects the payload into the
    //    live item_templates table.
    const published = await request(app.getHttpServer())
      .post(`/api/v1/admin/content-revisions/${revisionId}/approve-publish`)
      .set("Cookie", admin2.cookie)
      .set("X-CSRF-Token", admin2.csrfToken)
      .expect(200);
    expect(published.body.status).toBe("published");
    expect(published.body.entityId).toEqual(expect.any(String));
    const itemTemplateId = published.body.entityId as string;

    const liveItems = await request(app.getHttpServer())
      .get("/api/v1/admin/item-templates")
      .set("Cookie", admin1.cookie)
      .expect(200);
    expect(liveItems.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: itemTemplateId, name: "Content revision draft item (edited)" })
      ])
    );

    // 7) Self-approval is blocked: an admin cannot approve their own submitted revision.
    const selfDraft = await request(app.getHttpServer())
      .post("/api/v1/admin/content-revisions")
      .set("Cookie", admin1.cookie)
      .set("X-CSRF-Token", admin1.csrfToken)
      .send({
        entityType: "item_template",
        entityId: itemTemplateId,
        payload: {
          name: "Content revision draft item (edited)",
          necessityLevel: "essential",
          reasonText: "Self-approval attempt.",
          active: true
        }
      })
      .expect(200);
    const selfDraftId = selfDraft.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/admin/content-revisions/${selfDraftId}/submit`)
      .set("Cookie", admin1.cookie)
      .set("X-CSRF-Token", admin1.csrfToken)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/content-revisions/${selfDraftId}/approve-publish`)
      .set("Cookie", admin1.cookie)
      .set("X-CSRF-Token", admin1.csrfToken)
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("CONTENT_REVISION_SELF_APPROVAL"));

    // A different admin can approve it.
    const selfDraftPublished = await request(app.getHttpServer())
      .post(`/api/v1/admin/content-revisions/${selfDraftId}/approve-publish`)
      .set("Cookie", admin2.cookie)
      .set("X-CSRF-Token", admin2.csrfToken)
      .expect(200);
    expect(selfDraftPublished.body.status).toBe("published");
    expect(selfDraftPublished.body.entityId).toBe(itemTemplateId);

    // 8) Reject flow: editor submits another revision against the now-existing
    //    entity; a (non-author) admin rejects it with a note.
    const rejectDraft = await request(app.getHttpServer())
      .post("/api/v1/admin/content-revisions")
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({
        entityType: "item_template",
        entityId: itemTemplateId,
        payload: {
          name: "Should be rejected",
          necessityLevel: "essential",
          reasonText: "This revision will be rejected."
        }
      })
      .expect(200);
    const rejectDraftId = rejectDraft.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/admin/content-revisions/${rejectDraftId}/submit`)
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .expect(200);

    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/admin/content-revisions/${rejectDraftId}/reject`)
      .set("Cookie", admin1.cookie)
      .set("X-CSRF-Token", admin1.csrfToken)
      .send({ note: "Not aligned with current copy guidelines." })
      .expect(200);
    expect(rejected.body).toMatchObject({
      status: "rejected",
      reviewNote: "Not aligned with current copy guidelines."
    });

    // Rejected revision did not touch the live table.
    const liveAfterReject = await request(app.getHttpServer())
      .get("/api/v1/admin/item-templates")
      .set("Cookie", admin1.cookie)
      .expect(200);
    expect(liveAfterReject.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: itemTemplateId, name: "Content revision draft item (edited)" })
      ])
    );
    expect(liveAfterReject.body.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Should be rejected" })])
    );

    // 9) Rollback: roll back to the very first published revision (name
    //    "Content revision draft item (edited)"), restoring it over the
    //    current live state.
    const rolledBack = await request(app.getHttpServer())
      .post(`/api/v1/admin/content-revisions/${revisionId}/rollback`)
      .set("Cookie", admin1.cookie)
      .set("X-CSRF-Token", admin1.csrfToken)
      .expect(200);
    expect(rolledBack.body.status).toBe("published");
    expect(rolledBack.body.entityId).toBe(itemTemplateId);
    expect(rolledBack.body.payload.name).toBe("Content revision draft item (edited)");
    expect(rolledBack.body.reviewNote).toContain("rollback from revision");

    const liveAfterRollback = await request(app.getHttpServer())
      .get("/api/v1/admin/item-templates")
      .set("Cookie", admin1.cookie)
      .expect(200);
    expect(liveAfterRollback.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: itemTemplateId, name: "Content revision draft item (edited)" })
      ])
    );

    // 10) Revision history for the entity now has 4 rows (initial publish,
    //     self-draft publish, rejected, rollback), all ordered newest-first.
    const history = await request(app.getHttpServer())
      .get(`/api/v1/admin/content-revisions?entityType=item_template&entityId=${itemTemplateId}`)
      .set("Cookie", admin1.cookie)
      .expect(200);
    expect(history.body.revisions.length).toBeGreaterThanOrEqual(4);
  });

  it("validates disclosure revision payloads against the key+text shape and publishes via upsert-by-key", async () => {
    await createAdmin("cr-editor-2@wooriai.local", "editor-password-2", "editor");
    await createAdmin("cr-admin-3@wooriai.local", "admin-password-3", "admin");
    await createAdmin("cr-admin-4@wooriai.local", "admin-password-4", "admin");

    const editor = await loginAndEnroll("cr-editor-2@wooriai.local", "editor-password-2");
    const admin3 = await loginAndEnroll("cr-admin-3@wooriai.local", "admin-password-3");
    const admin4 = await loginAndEnroll("cr-admin-4@wooriai.local", "admin-password-4");

    // Missing `key` is rejected by the disclosure payload DTO.
    await request(app.getHttpServer())
      .post("/api/v1/admin/content-revisions")
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({ entityType: "disclosure", payload: { text: "Missing key." } })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("CONTENT_REVISION_PAYLOAD_INVALID"));

    const key = `cr_e2e_disclosure_${Date.now()}`;
    const draft = await request(app.getHttpServer())
      .post("/api/v1/admin/content-revisions")
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({ entityType: "disclosure", payload: { key, text: "Draft disclosure copy." } })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/content-revisions/${draft.body.id}/submit`)
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .expect(200);

    // Editor is blocked from the direct PUT disclosures endpoint too.
    await request(app.getHttpServer())
      .put(`/api/v1/admin/disclosures/${key}`)
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({ text: "Editor direct update should be forbidden." })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/content-revisions/${draft.body.id}/approve-publish`)
      .set("Cookie", admin3.cookie)
      .set("X-CSRF-Token", admin3.csrfToken)
      .expect(200);

    const disclosures = await request(app.getHttpServer())
      .get("/api/v1/admin/disclosures")
      .set("Cookie", admin4.cookie)
      .expect(200);
    expect(disclosures.body.disclosures).toEqual(
      expect.arrayContaining([expect.objectContaining({ key, text: "Draft disclosure copy." })])
    );
  });

  // M-2 diff-review follow-up: approvePublish now does an atomic CAS claim
  // (in_review -> publishing) before the live write, so two concurrent
  // approve-publish calls for the same revision can't both succeed.
  it("lets only one of two concurrent approve-publish calls for the same revision succeed", async () => {
    await createAdmin("cr-editor-3@wooriai.local", "editor-password-3", "editor");
    await createAdmin("cr-admin-5@wooriai.local", "admin-password-5", "admin");
    await createAdmin("cr-admin-6@wooriai.local", "admin-password-6", "admin");

    const editor = await loginAndEnroll("cr-editor-3@wooriai.local", "editor-password-3");
    const admin5 = await loginAndEnroll("cr-admin-5@wooriai.local", "admin-password-5");
    const admin6 = await loginAndEnroll("cr-admin-6@wooriai.local", "admin-password-6");

    // Unique per run: this suite runs against a persistent Postgres database
    // (see test/global-setup.ts), so a literal name would accumulate extra
    // matching rows across repeated runs and make the "exactly one" assertion
    // below flaky.
    const itemName = `Concurrent approval race item ${randomUUID()}`;
    const draft = await request(app.getHttpServer())
      .post("/api/v1/admin/content-revisions")
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({
        entityType: "item_template",
        payload: { name: itemName, necessityLevel: "essential", reasonText: "M-2 race test." }
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/content-revisions/${draft.body.id}/submit`)
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .expect(200);

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/admin/content-revisions/${draft.body.id}/approve-publish`)
        .set("Cookie", admin5.cookie)
        .set("X-CSRF-Token", admin5.csrfToken),
      request(app.getHttpServer())
        .post(`/api/v1/admin/content-revisions/${draft.body.id}/approve-publish`)
        .set("Cookie", admin6.cookie)
        .set("X-CSRF-Token", admin6.csrfToken)
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 400]);

    const failed = first.status === 400 ? first : second;
    expect(failed.body.error.code).toBe("CONTENT_REVISION_INVALID_STATE");

    const succeeded = first.status === 200 ? first : second;
    expect(succeeded.body.status).toBe("published");

    // Exactly one live item_template was created -- not double-published.
    const liveItems = await request(app.getHttpServer())
      .get("/api/v1/admin/item-templates")
      .set("Cookie", admin5.cookie)
      .expect(200);
    const matching = (liveItems.body.items as Array<{ name: string }>).filter((item) => item.name === itemName);
    expect(matching).toHaveLength(1);
  });

  // L-4 diff-review follow-up: entityId and payload.key must agree for
  // disclosure revisions (disclosures are upserted live by key, not id).
  it("rejects a disclosure revision whose entityId and payload.key point at different disclosures", async () => {
    await createAdmin("cr-editor-4@wooriai.local", "editor-password-4", "editor");
    const editor = await loginAndEnroll("cr-editor-4@wooriai.local", "editor-password-4");

    const keyA = `cr_e2e_disclosure_a_${Date.now()}`;
    const keyB = `cr_e2e_disclosure_b_${Date.now()}`;
    const disclosureA = await prisma.disclosure.create({ data: { key: keyA, text: "Disclosure A." } });
    await prisma.disclosure.create({ data: { key: keyB, text: "Disclosure B." } });

    await request(app.getHttpServer())
      .post("/api/v1/admin/content-revisions")
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({ entityType: "disclosure", entityId: disclosureA.id, payload: { key: keyB, text: "Should be rejected." } })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("CONTENT_REVISION_DISCLOSURE_KEY_MISMATCH"));

    const draft = await request(app.getHttpServer())
      .post("/api/v1/admin/content-revisions")
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({ entityType: "disclosure", entityId: disclosureA.id, payload: { key: keyA, text: "Updated A copy." } })
      .expect(200);

    // PATCH enforces the same guard on an in-place draft edit.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/content-revisions/${draft.body.id}`)
      .set("Cookie", editor.cookie)
      .set("X-CSRF-Token", editor.csrfToken)
      .send({ payload: { key: keyB, text: "Should also be rejected." } })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("CONTENT_REVISION_DISCLOSURE_KEY_MISMATCH"));
  });

  // COM-103b: PATCH :id/schedule wires up the previously-dead scheduledFor
  // column end-to-end with the worker's ScheduledPublishJob (whose run() is
  // driven directly here, like worker-jobs.db.test.ts -- the scheduler loop
  // stays env-gated off).
  describe("scheduled publishing (COM-103b)", () => {
    const MINUTE_MS = 60 * 1000;
    const HOUR_MS = 60 * MINUTE_MS;

    it("schedules an in_review revision (admin-only, future-only, not on drafts) and the worker publishes it once due", async () => {
      await createAdmin("cr-editor-5@wooriai.local", "editor-password-5", "editor");
      await createAdmin("cr-admin-7@wooriai.local", "admin-password-7", "admin");
      const editor = await loginAndEnroll("cr-editor-5@wooriai.local", "editor-password-5");
      const admin7 = await loginAndEnroll("cr-admin-7@wooriai.local", "admin-password-7");

      const key = `cr_e2e_sched_${Date.now()}`;
      const draft = await request(app.getHttpServer())
        .post("/api/v1/admin/content-revisions")
        .set("Cookie", editor.cookie)
        .set("X-CSRF-Token", editor.csrfToken)
        .send({ entityType: "disclosure", payload: { key, text: "예약 게시 문구 (e2e)" } })
        .expect(200);
      const revisionId = draft.body.id as string;
      const futureIso = new Date(Date.now() + HOUR_MS).toISOString();

      // Only in_review revisions can be scheduled -- a draft is rejected.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content-revisions/${revisionId}/schedule`)
        .set("Cookie", admin7.cookie)
        .set("X-CSRF-Token", admin7.csrfToken)
        .send({ scheduledFor: futureIso })
        .expect(400)
        .expect(({ body }) => expect(body.error.code).toBe("CONTENT_REVISION_INVALID_STATE"));

      await request(app.getHttpServer())
        .post(`/api/v1/admin/content-revisions/${revisionId}/submit`)
        .set("Cookie", editor.cookie)
        .set("X-CSRF-Token", editor.csrfToken)
        .expect(200);

      // RBAC: scheduling is a publish decision, so it's admin-only like
      // approve-publish -- the (author) editor is 403'd by role, not just by
      // the self-schedule guard.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content-revisions/${revisionId}/schedule`)
        .set("Cookie", editor.cookie)
        .set("X-CSRF-Token", editor.csrfToken)
        .send({ scheduledFor: futureIso })
        .expect(403)
        .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));

      // Past timestamps are rejected.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content-revisions/${revisionId}/schedule`)
        .set("Cookie", admin7.cookie)
        .set("X-CSRF-Token", admin7.csrfToken)
        .send({ scheduledFor: new Date(Date.now() - MINUTE_MS).toISOString() })
        .expect(400)
        .expect(({ body }) => expect(body.error.code).toBe("CONTENT_REVISION_SCHEDULE_IN_PAST"));

      // scheduledFor is required (null clears, omitted is a validation error).
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content-revisions/${revisionId}/schedule`)
        .set("Cookie", admin7.cookie)
        .set("X-CSRF-Token", admin7.csrfToken)
        .send({})
        .expect(400)
        .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));

      const scheduled = await request(app.getHttpServer())
        .patch(`/api/v1/admin/content-revisions/${revisionId}/schedule`)
        .set("Cookie", admin7.cookie)
        .set("X-CSRF-Token", admin7.csrfToken)
        .send({ scheduledFor: futureIso })
        .expect(200);
      expect(scheduled.body.status).toBe("in_review");
      expect(new Date(scheduled.body.scheduledFor as string).toISOString()).toBe(futureIso);

      // Not due yet: a worker tick at "now" leaves the revision untouched.
      const notDueResult = await scheduledPublishJob.run(new Date());
      expect((notDueResult.published as string[] | undefined) ?? []).not.toContain(revisionId);
      const stillPending = await prisma.contentRevision.findUniqueOrThrow({ where: { id: revisionId } });
      expect(stillPending.status).toBe("in_review");

      // Due: a tick after scheduledFor publishes through the shared CAS path.
      const dueAt = new Date(Date.now() + HOUR_MS + MINUTE_MS);
      const dueResult = await scheduledPublishJob.run(dueAt);
      expect(dueResult.published).toContain(revisionId);

      const published = await prisma.contentRevision.findUniqueOrThrow({ where: { id: revisionId } });
      expect(published.status).toBe("published");
      // No human reviewer on a worker publish; scheduledFor stays as the
      // historical scheduled time.
      expect(published.reviewerAdminId).toBeNull();
      expect(published.scheduledFor?.toISOString()).toBe(futureIso);

      const live = await prisma.disclosure.findUnique({ where: { key } });
      expect(live?.text).toBe("예약 게시 문구 (e2e)");
    });

    it("blocks self-scheduling, lets null unschedule (worker then skips it), and manual approve-publish clears scheduledFor", async () => {
      await createAdmin("cr-admin-8@wooriai.local", "admin-password-8", "admin");
      await createAdmin("cr-admin-9@wooriai.local", "admin-password-9", "admin");
      const admin8 = await loginAndEnroll("cr-admin-8@wooriai.local", "admin-password-8");
      const admin9 = await loginAndEnroll("cr-admin-9@wooriai.local", "admin-password-9");

      const key = `cr_e2e_sched_self_${Date.now()}`;
      const draft = await request(app.getHttpServer())
        .post("/api/v1/admin/content-revisions")
        .set("Cookie", admin8.cookie)
        .set("X-CSRF-Token", admin8.csrfToken)
        .send({ entityType: "disclosure", payload: { key, text: "예약 해제 검증 문구" } })
        .expect(200);
      const revisionId = draft.body.id as string;
      await request(app.getHttpServer())
        .post(`/api/v1/admin/content-revisions/${revisionId}/submit`)
        .set("Cookie", admin8.cookie)
        .set("X-CSRF-Token", admin8.csrfToken)
        .expect(200);

      const futureIso = new Date(Date.now() + HOUR_MS).toISOString();

      // Same author/approver separation as approve-publish: the submitting
      // admin cannot schedule their own revision.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content-revisions/${revisionId}/schedule`)
        .set("Cookie", admin8.cookie)
        .set("X-CSRF-Token", admin8.csrfToken)
        .send({ scheduledFor: futureIso })
        .expect(403)
        .expect(({ body }) => expect(body.error.code).toBe("CONTENT_REVISION_SELF_SCHEDULE"));

      // A different admin can schedule it...
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content-revisions/${revisionId}/schedule`)
        .set("Cookie", admin9.cookie)
        .set("X-CSRF-Token", admin9.csrfToken)
        .send({ scheduledFor: futureIso })
        .expect(200);

      // ...and clear it again with null.
      const unscheduled = await request(app.getHttpServer())
        .patch(`/api/v1/admin/content-revisions/${revisionId}/schedule`)
        .set("Cookie", admin9.cookie)
        .set("X-CSRF-Token", admin9.csrfToken)
        .send({ scheduledFor: null })
        .expect(200);
      expect(unscheduled.body.scheduledFor).toBeNull();

      // A worker tick even past the (cleared) schedule no longer publishes it.
      const tickResult = await scheduledPublishJob.run(new Date(Date.now() + 2 * HOUR_MS));
      expect((tickResult.published as string[] | undefined) ?? []).not.toContain(revisionId);
      const stillInReview = await prisma.contentRevision.findUniqueOrThrow({ where: { id: revisionId } });
      expect(stillInReview.status).toBe("in_review");
      expect(stillInReview.publishedAt).toBeNull();

      // Re-schedule, then approve manually: the manual publish supersedes and
      // clears the pending schedule.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content-revisions/${revisionId}/schedule`)
        .set("Cookie", admin9.cookie)
        .set("X-CSRF-Token", admin9.csrfToken)
        .send({ scheduledFor: futureIso })
        .expect(200);
      const published = await request(app.getHttpServer())
        .post(`/api/v1/admin/content-revisions/${revisionId}/approve-publish`)
        .set("Cookie", admin9.cookie)
        .set("X-CSRF-Token", admin9.csrfToken)
        .expect(200);
      expect(published.body.status).toBe("published");
      expect(published.body.scheduledFor).toBeNull();
    });
  });
});
