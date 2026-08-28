import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { generate as generateTotp } from "otplib";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../src/admin/admin-password";
import { CONTENT_REVISIONS_LIST_LIMIT, SYSTEM_WORKER_ACTOR } from "../src/admin/content-revisions.service";
import { AppModule } from "../src/app.module";
import { AuditLoggerService } from "../src/common/audit/audit-logger.service";
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
  let auditLogger: AuditLoggerService;

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
    auditLogger = moduleRef.get(AuditLoggerService, { strict: false });
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

  /**
   * 라운드 48 QA(P2-4) — 검수 화면 diff의 오탐.
   *
   * 검수 화면(apps/admin/app/reviews/page.tsx `diffFields`)은 payload와 live 스냅숏의 **키
   * 합집합**을 돌며 `JSON.stringify(before) !== JSON.stringify(after)`로 "변경됨"을 판정한다.
   * 그래서 한쪽에만 있는 키는 before가 늘 `(없음)`이라 **무조건 변경됨**으로 뜬다.
   *
   * 라운드 48 T1이 `medicalDisclaimerRequired`를 어드민 편집 대상으로 열어(DNC-020) payload에는
   * 실리게 됐는데 `getLiveSnapshot`의 item_template 분기에는 더해지지 않아, 이 필드를 건드리지
   * 않은 리비전까지 매번 변경됨으로 표시됐다. 검수자가 진짜 변경점을 가려내지 못하면 그 화면은
   * 안전장치 노릇을 못 한다.
   *
   * 아래는 화면과 **같은 규칙**으로 판정해 두 방향을 함께 못박는다: 값이 같으면 뜨지 않고,
   * 실제로 바뀌면 여전히 뜬다(스냅숏에 넣느라 판정 자체가 둔해지지 않았다는 확인).
   */
  it("live 스냅숏이 medicalDisclaimerRequired를 실어, 값이 그대로인 리비전은 diff에 '변경됨'으로 뜨지 않는다", async () => {
    await createAdmin("cr-admin-md@wooriai.local", "admin-password-md", "admin");
    const admin = await loginAndEnroll("cr-admin-md@wooriai.local", "admin-password-md");

    /** 검수 화면 diffFields와 같은 판정(한 필드만). */
    const isChanged = (live: Record<string, unknown> | null, payload: Record<string, unknown>, field: string) => {
      const before = live && live[field] !== undefined ? JSON.stringify(live[field]) : "(없음)";
      const after = payload[field] !== undefined ? JSON.stringify(payload[field]) : "(없음)";
      return before !== after;
    };

    // 1) 라이브 준비템 하나(의료 고지 ON). 리비전 흐름 이전의 준비 단계라 직접 생성한다.
    const itemName = `MD disclaimer diff guard ${randomUUID()}`;
    const liveItem = await request(app.getHttpServer())
      .post("/api/v1/admin/item-templates")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({
        name: itemName,
        necessityLevel: "essential",
        reasonText: "P2-4 회귀 케이스용.",
        medicalDisclaimerRequired: true
      })
      .expect(200);
    const itemTemplateId = liveItem.body.id as string;
    expect(liveItem.body.medicalDisclaimerRequired).toBe(true);

    // 2) 이 필드를 **건드리지 않는** 초안 — 값은 라이브와 같게 실어 보낸다(어드민 폼이 현재
    //    값을 그대로 다시 제출하는 것과 같은 모양).
    const unchangedDraft = await request(app.getHttpServer())
      .post("/api/v1/admin/content-revisions")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({
        entityType: "item_template",
        entityId: itemTemplateId,
        payload: {
          name: itemName,
          necessityLevel: "essential",
          reasonText: "P2-4 회귀 케이스용.",
          medicalDisclaimerRequired: true
        }
      })
      .expect(200);

    const unchangedDetail = await request(app.getHttpServer())
      .get(`/api/v1/admin/content-revisions/${unchangedDraft.body.id}`)
      .set("Cookie", admin.cookie)
      .expect(200);

    // 스냅숏이 그 필드를 **싣는다**(이게 빠져 있던 것이 버그의 원인이다).
    expect(unchangedDetail.body.live).not.toBeNull();
    expect(unchangedDetail.body.live).toHaveProperty("medicalDisclaimerRequired", true);
    // 그래서 화면 규칙으로도 변경됨이 아니다.
    expect(isChanged(unchangedDetail.body.live, unchangedDetail.body.payload, "medicalDisclaimerRequired")).toBe(false);
    // 같은 이유로 예전부터 실려 있던 이웃 필드들도 그대로 조용하다(회귀 확인).
    expect(isChanged(unchangedDetail.body.live, unchangedDetail.body.payload, "name")).toBe(false);
    expect(isChanged(unchangedDetail.body.live, unchangedDetail.body.payload, "necessityLevel")).toBe(false);

    // 3) 반대 방향: 실제로 값을 바꾸는 초안은 여전히 변경됨으로 뜬다.
    const changedDraft = await request(app.getHttpServer())
      .post("/api/v1/admin/content-revisions")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({
        entityType: "item_template",
        entityId: itemTemplateId,
        payload: {
          name: itemName,
          necessityLevel: "essential",
          reasonText: "P2-4 회귀 케이스용.",
          medicalDisclaimerRequired: false
        }
      })
      .expect(200);

    const changedDetail = await request(app.getHttpServer())
      .get(`/api/v1/admin/content-revisions/${changedDraft.body.id}`)
      .set("Cookie", admin.cookie)
      .expect(200);
    expect(isChanged(changedDetail.body.live, changedDetail.body.payload, "medicalDisclaimerRequired")).toBe(true);
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

  /**
   * GAP-066 #7 (known-limitations §J 해소): 리비전으로 발행된 값의 **이전 값**.
   *
   * 두 발행 경로의 감사 봉투에는 `after`뿐이라 "무엇에서" 바꿨는지가 서버 어디에도
   * 없었다. 고지(`disclosures`)는 key당 한 칸 upsert라 덮어쓰는 순간 이전 문구가
   * 사실 자체로 사라지고, 리비전 행에는 발행할 payload(=새 문구)만 있다 — 그래서
   * "원래 문구로 되돌려 주세요" CS에서 되돌릴 값이 남는 곳은 이 봉투뿐이다.
   */
  describe("publish audit envelope (GAP-066 #7)", () => {
    let envEditor: { cookie: string; csrfToken: string };
    let envAdmin: { cookie: string; csrfToken: string };

    beforeAll(async () => {
      await createAdmin("cr-editor-6@wooriai.local", "editor-password-6", "editor");
      await createAdmin("cr-admin-10@wooriai.local", "admin-password-10", "admin");
      envEditor = await loginAndEnroll("cr-editor-6@wooriai.local", "editor-password-6");
      envAdmin = await loginAndEnroll("cr-admin-10@wooriai.local", "admin-password-10");
    });

    async function draftAndSubmit(payload: Record<string, unknown>, entityType: string, entityId?: string) {
      const draft = await request(app.getHttpServer())
        .post("/api/v1/admin/content-revisions")
        .set("Cookie", envEditor.cookie)
        .set("X-CSRF-Token", envEditor.csrfToken)
        .send(entityId ? { entityType, entityId, payload } : { entityType, payload })
        .expect(200);
      const revisionId = draft.body.id as string;
      await request(app.getHttpServer())
        .post(`/api/v1/admin/content-revisions/${revisionId}/submit`)
        .set("Cookie", envEditor.cookie)
        .set("X-CSRF-Token", envEditor.csrfToken)
        .expect(200);
      return revisionId;
    }

    function publishEntry(action: string, revisionId: string) {
      return auditLogger.entries.find((entry) => entry.action === action && entry.targetId === revisionId);
    }

    it("records the pre-publish live copy as `before` on approve_publish (고지는 key로 찾는다)", async () => {
      // 라이브에 이미 서 있는 DNC-010 문구. 초안은 **entityId 없이** 만들어진다 —
      // 고지는 id가 아니라 key로 주소지정되므로(publishToLive의 upsert-by-key) 이것이
      // 실제 운영에서 흔한 모양이고, entityId만 보면 before가 늘 null이 되는 자리다.
      const key = `cr_e2e_audit_before_${Date.now()}`;
      await prisma.disclosure.create({
        data: { key, text: "이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요." }
      });

      const revisionId = await draftAndSubmit({ key, text: "제휴 링크예요." }, "disclosure");
      await request(app.getHttpServer())
        .post(`/api/v1/admin/content-revisions/${revisionId}/approve-publish`)
        .set("Cookie", envAdmin.cookie)
        .set("X-CSRF-Token", envAdmin.csrfToken)
        .expect(200);

      const entry = publishEntry("admin.content_revision.approve_publish", revisionId);
      // 되돌릴 값 — 바뀌기 **전** 문구가 봉투에 그대로 있다.
      expect(entry?.before).toEqual({
        key,
        text: "이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요."
      });
      // 어느 문구인지는 after.key가 답한다(targetId는 revision id라 답하지 못한다).
      expect(entry?.after).toMatchObject({ entityType: "disclosure", key });
      // 봉투는 운영이 쓴 공개 문구 두 칸뿐 — 사용자 데이터(PII)는 없다.
      expect(Object.keys(entry!.before!).sort()).toEqual(["key", "text"]);
      // 라이브는 새 문구로 덮여 이전 문구는 사라졌다. 남은 근거가 위 봉투다.
      const live = await prisma.disclosure.findUnique({ where: { key } });
      expect(live?.text).toBe("제휴 링크예요.");
    });

    it("leaves `before` null when the disclosure key did not exist yet (새 문구 표식)", async () => {
      const key = `cr_e2e_audit_new_${Date.now()}`;
      const revisionId = await draftAndSubmit({ key, text: "처음 세우는 고지 문구예요." }, "disclosure");
      await request(app.getHttpServer())
        .post(`/api/v1/admin/content-revisions/${revisionId}/approve-publish`)
        .set("Cookie", envAdmin.cookie)
        .set("X-CSRF-Token", envAdmin.csrfToken)
        .expect(200);

      const entry = publishEntry("admin.content_revision.approve_publish", revisionId);
      // 라운드 65 E(admin.disclosure.update)와 같은 표식: null = 그 key가 없던 새 문구.
      expect(entry?.before ?? null).toBeNull();
      // 그래도 어느 key를 세운 발행인지는 봉투가 답한다.
      expect(entry?.after).toMatchObject({ entityType: "disclosure", key });
    });

    it("records the same `before` on the worker's scheduled publish (사람이 자리에 없는 순간)", async () => {
      const HOUR_MS = 60 * 60 * 1000;
      const key = `cr_e2e_audit_sched_${Date.now()}`;
      await prisma.disclosure.create({ data: { key, text: "예약 전 고지 문구예요." } });

      const revisionId = await draftAndSubmit({ key, text: "예약으로 바뀐 고지 문구예요." }, "disclosure");
      const futureIso = new Date(Date.now() + HOUR_MS).toISOString();
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content-revisions/${revisionId}/schedule`)
        .set("Cookie", envAdmin.cookie)
        .set("X-CSRF-Token", envAdmin.csrfToken)
        .send({ scheduledFor: futureIso })
        .expect(200);

      const result = await scheduledPublishJob.run(new Date(Date.now() + 2 * HOUR_MS));
      expect(result.published).toContain(revisionId);

      const entry = publishEntry("admin.content_revision.scheduled_publish", revisionId);
      expect(entry?.before).toEqual({ key, text: "예약 전 고지 문구예요." });
      // 행위자 표기 관례는 그대로다 — 워커 발행은 사람이 아니다.
      expect(entry?.actorUserId).toBe(SYSTEM_WORKER_ACTOR);
      expect(entry?.after).toMatchObject({ entityType: "disclosure", key, scheduledFor: futureIso });
    });

    it("carries a live snapshot for item_template publishes too, with no disclosure `key` in the envelope", async () => {
      // 1) 신규 생성 발행: 라이브에 아직 행이 없으므로 before는 null이다.
      const createRevisionId = await draftAndSubmit(
        {
          name: "GAP-066 감사 봉투 준비템",
          necessityLevel: "essential",
          reasonText: "발행 봉투 e2e.",
          safetyNote: "반드시 보호자와 함께 쓰세요."
        },
        "item_template"
      );
      const created = await request(app.getHttpServer())
        .post(`/api/v1/admin/content-revisions/${createRevisionId}/approve-publish`)
        .set("Cookie", envAdmin.cookie)
        .set("X-CSRF-Token", envAdmin.csrfToken)
        .expect(200);
      const entityId = created.body.entityId as string;
      expect(publishEntry("admin.content_revision.approve_publish", createRevisionId)?.before ?? null).toBeNull();

      // 2) 같은 준비템의 안전 주의 문구를 약하게 바꾸는 발행 — "누가 안전 주의를
      //    약하게 바꿨나"가 고지와 같은 모양의 질문이라 여기에도 before가 있어야 한다.
      const updateRevisionId = await draftAndSubmit(
        {
          name: "GAP-066 감사 봉투 준비템",
          necessityLevel: "essential",
          reasonText: "발행 봉투 e2e.",
          safetyNote: "적당히 쓰세요."
        },
        "item_template",
        entityId
      );
      await request(app.getHttpServer())
        .post(`/api/v1/admin/content-revisions/${updateRevisionId}/approve-publish`)
        .set("Cookie", envAdmin.cookie)
        .set("X-CSRF-Token", envAdmin.csrfToken)
        .expect(200);

      const entry = publishEntry("admin.content_revision.approve_publish", updateRevisionId);
      expect(entry?.before).toMatchObject({
        name: "GAP-066 감사 봉투 준비템",
        safetyNote: "반드시 보호자와 함께 쓰세요."
      });
      // 검수 diff가 쓰는 스냅숏과 같은 모양이다(고정 필드 목록 — 봉투가 무한히 자라지 않는다).
      expect(Array.isArray((entry!.before as { stageCodes?: unknown }).stageCodes)).toBe(true);
      // 고지가 아닌 발행의 봉투에는 `key`가 없다 — entityId가 이미 그 답을 한다.
      expect(entry?.after).toEqual({ entityType: "item_template", entityId });
    });
  });

  // PERF-115(F4): the list endpoint used to have no LIMIT; it is now capped at
  // CONTENT_REVISIONS_LIST_LIMIT (newest-first), response contract unchanged.
  it("caps the list response at CONTENT_REVISIONS_LIST_LIMIT rows, newest-first", async () => {
    await createAdmin("cr-limit-admin@wooriai.local", "admin-password-limit", "admin");
    const admin = await loginAndEnroll("cr-limit-admin@wooriai.local", "admin-password-limit");
    const adminRow = await prisma.adminUser.findUniqueOrThrow({ where: { email: "cr-limit-admin@wooriai.local" } });

    // Seed CONTENT_REVISIONS_LIST_LIMIT + 5 history rows for one entity
    // directly (the API can't create >1 draft revision per entity, and
    // content_revisions carries no FK to the live tables — 000007). A fresh
    // random entityId isolates this history from every other suite's rows.
    const entityId = randomUUID();
    const total = CONTENT_REVISIONS_LIST_LIMIT + 5;
    await prisma.contentRevision.createMany({
      data: Array.from({ length: total }, (_, i) => ({
        entityType: "disclosure",
        entityId,
        revisionNo: i + 1,
        payload: { key: "perf115_f4", text: `rev ${i + 1}` },
        status: "published",
        authorAdminId: adminRow.id
      }))
    });

    const list = await request(app.getHttpServer())
      .get(`/api/v1/admin/content-revisions?entityType=disclosure&entityId=${entityId}`)
      .set("Cookie", admin.cookie)
      .expect(200);

    // Contract shape intact, but capped: 105 rows exist, 100 come back.
    expect(Array.isArray(list.body.revisions)).toBe(true);
    expect(list.body.revisions.length).toBe(CONTENT_REVISIONS_LIST_LIMIT);
    // The unfiltered list (every suite's rows) is bounded by the same cap.
    const unfiltered = await request(app.getHttpServer())
      .get("/api/v1/admin/content-revisions")
      .set("Cookie", admin.cookie)
      .expect(200);
    expect(unfiltered.body.revisions.length).toBeLessThanOrEqual(CONTENT_REVISIONS_LIST_LIMIT);
  });
});
