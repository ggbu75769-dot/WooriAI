import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { AuditLoggerService } from "../src/common/audit/audit-logger.service";

const adminToken = "dev-admin-token";
const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// Round 4: dev-login now persists a real users/households row per providerToken
// (instead of a per-process in-memory Map), so reusing the same literal
// providerToken across test runs against a persistent database would reuse the
// same account/household and leak state between runs. Appending a random suffix
// keeps every login (even with the same descriptive prefix) isolated.
async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `${providerToken}-${randomUUID()}` })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

async function completeOnboarding(app: INestApplication, accessToken: string) {
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
      .send({
        householdId,
        nickname: "batch10-child",
        stageMode: "manual",
        manualStage: "infant_4_6"
      })
      .expect(200)
  ).body.id as string;

  await request(app.getHttpServer())
    .post(`/api/v1/children/${childId}/prepared-items`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ itemTemplateIds: [] })
    .expect(200);

  await request(app.getHttpServer())
    .put(`/api/v1/children/${childId}/budget`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ yearMonth: "2026-07-01", amountKrw: 300000 })
    .expect(200);

  return { householdId, childId };
}

describe("Admin CMS and settings APIs", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_ADMIN_TOKEN = adminToken;
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_ADMIN_TOKEN;
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  it("lets internal admins update preparation items, product links, and disclosure copy without a mobile deploy", async () => {
    const accessToken = await login(app, "batch10-admin-cms");
    const { childId } = await completeOnboarding(app, accessToken);

    await request(app.getHttpServer()).get("/api/v1/admin/item-templates").expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/admin/item-templates")
      .set("x-admin-token", adminToken)
      .send({
        name: "Optional without skip copy",
        necessityLevel: "optional",
        reasonText: "This should be rejected."
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("ADMIN_SKIP_REASON_REQUIRED");
      });

    const itemTemplate = (
      await request(app.getHttpServer())
        .post("/api/v1/admin/item-templates")
        .set("x-admin-token", adminToken)
        .send({
          name: "Batch10 stroller fan",
          categoryId,
          necessityLevel: "optional",
          timingLabel: "summer outings",
          reasonText: "Keeps stroller outings more comfortable.",
          skipReasonText: "Skip when outings are short or shaded.",
          usedSecondhandOk: true,
          stageCodes: ["infant_4_6"],
          active: true
        })
        .expect(200)
    ).body as { id: string; name: string };

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/item-templates/${itemTemplate.id}`)
      .set("x-admin-token", adminToken)
      .send({ reasonText: "Updated by admin CMS." })
      .expect(200)
      .expect(({ body }) => {
        expect(body.reasonText).toBe("Updated by admin CMS.");
      });

    await request(app.getHttpServer())
      .put("/api/v1/admin/disclosures/affiliate_purchase")
      .set("x-admin-token", adminToken)
      .send({ text: "Batch10 affiliate disclosure near CTA." })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ key: "affiliate_purchase", text: "Batch10 affiliate disclosure near CTA." });
      });

    await request(app.getHttpServer())
      .post("/api/v1/admin/product-links")
      .set("x-admin-token", adminToken)
      .send({
        itemTemplateId: itemTemplate.id,
        platform: "custom",
        title: "Malicious scheme link",
        url: "javascript:alert(1)",
        isAffiliate: false,
        isSponsored: false,
        active: true
      })
      .expect(400);

    const productLink = (
      await request(app.getHttpServer())
        .post("/api/v1/admin/product-links")
        .set("x-admin-token", adminToken)
        .send({
          itemTemplateId: itemTemplate.id,
          platform: "custom",
          title: "Admin managed shop link",
          url: "https://example.com/admin-managed",
          isAffiliate: true,
          isSponsored: false,
          active: true
        })
        .expect(200)
    ).body as { id: string };

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/product-links/${productLink.id}`)
      .set("x-admin-token", adminToken)
      .send({ url: "data:text/html,evil" })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/product-links/${productLink.id}`)
      .set("x-admin-token", adminToken)
      .send({
        title: "Updated admin shop link",
        disclosureText: "Specific product disclosure override."
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: productLink.id,
          title: "Updated admin shop link",
          disclosureText: "Specific product disclosure override."
        });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items/${itemTemplate.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: itemTemplate.id,
          reasonText: "Updated by admin CMS."
        });
        expect(body.productLinks).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: productLink.id,
              title: "Updated admin shop link",
              isAffiliate: true,
              disclosureText: "Specific product disclosure override."
            })
          ])
        );
      });
  });

  it("keeps account deletion, household leave, and child profile deletion as separate two-step settings flows", async () => {
    const accessToken = await login(app, "batch10-settings");
    const { householdId, childId } = await completeOnboarding(app, accessToken);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId,
        amountKrw: 15000,
        spentOn: "2026-07-06",
        itemName: "삭제될 지출",
        paymentMethod: "card"
      })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/v1/settings/privacy")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.flows.map((flow: { id: string }) => flow.id)).toEqual([
          "account_delete",
          "household_leave",
          "child_profile_delete"
        ]);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/settings/children/${childId}/delete-preview`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          flowId: "child_profile_delete",
          confirmationText: "DELETE CHILD",
          requiresSecondStep: true
        });
        // 라운드 45 UX-Y: impact는 모바일 SET-003이 그대로 보여주는 사용자 문구라 한국어 해요체다.
        expect(body.impact).toEqual(expect.arrayContaining([expect.stringContaining("아이 프로필")]));
      });

    await request(app.getHttpServer())
      .post(`/api/v1/settings/children/${childId}/delete-confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ confirmationText: "WRONG" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("SETTINGS_CONFIRMATION_REQUIRED");
      });

    await request(app.getHttpServer())
      .post(`/api/v1/settings/children/${childId}/delete-confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ confirmationText: "DELETE CHILD" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true, flowId: "child_profile_delete" });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);

    const auditLogger = moduleRef.get(AuditLoggerService);
    expect(auditLogger.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: expect.any(String),
          householdId,
          action: "child_profile.delete",
          targetType: "child_profile",
          targetId: childId,
          after: expect.objectContaining({ deletedExpenseCount: 1, deletedAt: expect.any(String) })
        })
      ])
    );

    await request(app.getHttpServer())
      .post(`/api/v1/settings/households/${householdId}/leave-preview`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.flowId).toBe("household_leave");
        expect(body.confirmationText).toBe("LEAVE HOUSEHOLD");
        // 라운드 45 UX-AA: 이 배열은 앱의 확인 상자에 그대로 그려지므로 한국어 해요체다
        // (예전 영문 "shared child data is no longer accessible..."을 그리던 자리).
        expect(body.impact).toEqual(["이 가구에 공유된 아이 기록을 볼 수 없어요"]);
      });

    await request(app.getHttpServer())
      .post("/api/v1/settings/account/delete-preview")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.flowId).toBe("account_delete");
        expect(body.confirmationText).toBe("DELETE ACCOUNT");
        expect(body.impact).toEqual(["이 계정으로는 다시 로그인할 수 없어요", "참여 중인 가구에서 모두 나가게 돼요"]);
      });

    await request(app.getHttpServer())
      .post("/api/v1/settings/account/delete-confirm")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ confirmationText: "DELETE ACCOUNT" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true, flowId: "account_delete" });
      });

    await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(401);
  });

  /**
   * GAP-062 #7: 되돌릴 수 없는 두 흐름(가구 탈퇴·계정 삭제)이 감사 로그에 남는다.
   *
   * 종전에는 같은 컨트롤러에서 아이 프로필 삭제만 기록됐고, "스스로 나갔다/탈퇴했다"는
   * 사실은 구성원 행의 `left` 표식과 `users.status=withdrawn`뿐이라 누가·언제·어느 경로로
   * 그랬는지에 CS가 답할 근거가 없었다. 계정 삭제는 더 심했다 — 파기 잡이 유예 기간 뒤
   * users 행을 물리 삭제하면 그 계정이 존재했다는 사실 자체가 사라진다.
   */
  it("records household.leave and account.delete audit entries for the two irreversible self-service flows", async () => {
    const accessToken = await login(app, "batch10-settings-audit");
    const { householdId } = await completeOnboarding(app, accessToken);
    const auditLogger = moduleRef.get(AuditLoggerService);

    // 확인 문구가 틀리면 아무 일도 없어야 한다 — 실패한 시도는 기록도 남기지 않는다.
    await request(app.getHttpServer())
      .post(`/api/v1/settings/households/${householdId}/leave-confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ confirmationText: "WRONG" })
      .expect(400);
    expect(auditLogger.entries.filter((entry) => entry.action === "household.leave")).toHaveLength(0);

    await request(app.getHttpServer())
      .post(`/api/v1/settings/households/${householdId}/leave-confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ confirmationText: "LEAVE HOUSEHOLD" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true, flowId: "household_leave" });
      });

    const leaveEntry = auditLogger.entries.find(
      (entry) => entry.action === "household.leave" && entry.householdId === householdId
    );
    expect(leaveEntry).toMatchObject({
      actorUserId: expect.any(String),
      householdId,
      action: "household.leave",
      targetType: "household",
      targetId: householdId,
      after: { flowId: "household_leave" }
    });
    // 봉투에 PII 금지: 지어낸 시각도, 닉네임/이메일도 싣지 않는다(시각은 행의 createdAt).
    expect(Object.keys(leaveEntry!.after!)).toEqual(["flowId"]);

    await request(app.getHttpServer())
      .post("/api/v1/settings/account/delete-confirm")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ confirmationText: "DELETE ACCOUNT" })
      .expect(200);

    const deleteEntry = auditLogger.entries.find(
      (entry) => entry.action === "account.delete" && entry.actorUserId === leaveEntry!.actorUserId
    );
    expect(deleteEntry).toMatchObject({
      actorUserId: leaveEntry!.actorUserId,
      action: "account.delete",
      targetType: "user",
      after: { flowId: "account_delete" }
    });
    // 탈퇴는 참여 중인 **모든** 가구에서 나가는 흐름이라 가구 하나를 골라 적지 않는다.
    expect(deleteEntry!.householdId).toBeUndefined();
    // 대상이 곧 행위자다 — 같은 uuid를 target_id에 복사하면 파기 잡 phase 3의
    // actor_user_id 익명화가 무력화되므로 싣지 않는다.
    expect(deleteEntry!.targetId).toBeUndefined();
  });

  /**
   * GAP-065 #9: DNC-010 고지 문구는 key당 한 칸 upsert라 덮어쓰면 이전 문구가 사라진다.
   * admin 역할은 검토(content revision) 없이 이 경로로 바로 덮어쓰므로, 고지가 약해진 뒤
   * 되돌릴 값이 남는 곳은 이 봉투뿐이다. 종전에는 `after`만 있어 "무엇에서" 바꿨는지
   * 서버가 몰랐다.
   */
  it("records admin.disclosure.update with a before/after copy pair (DNC-010)", async () => {
    const auditLogger = moduleRef.get(AuditLoggerService);
    // 키는 전역이라 고정 문자열을 쓰면 다음 실행에서 before가 null이 아니게 된다.
    const key = `gap065-probe-${randomUUID()}`;

    await request(app.getHttpServer())
      .put(`/api/v1/admin/disclosures/${key}`)
      .set("x-admin-token", adminToken)
      .send({ text: "  처음 세우는 고지 문구예요.  " })
      .expect(200)
      .expect(({ body }) => {
        // 응답은 종전과 같은 {key, text} 그대로다 — 봉투가 응답으로 새지 않는다.
        expect(body).toEqual({ key, text: "처음 세우는 고지 문구예요." });
      });

    const created = auditLogger.entries.find(
      (entry) => entry.action === "admin.disclosure.update" && entry.targetId === key
    );
    expect(created).toMatchObject({
      action: "admin.disclosure.update",
      targetType: "disclosures",
      targetId: key,
      // before가 null이면 "그 key가 없던 새 문구" — 오타 키로 저장했을 때의 표식이다.
      before: null,
      // 저장된 값(trim 후)을 싣는다 — 요청 body 원문이 아니라 앱이 읽게 될 값이다.
      after: { key, text: "처음 세우는 고지 문구예요." }
    });

    await request(app.getHttpServer())
      .put(`/api/v1/admin/disclosures/${key}`)
      .set("x-admin-token", adminToken)
      .send({ text: "약해진 고지 문구예요." })
      .expect(200);

    const overwritten = auditLogger.entries.filter(
      (entry) => entry.action === "admin.disclosure.update" && entry.targetId === key
    );
    expect(overwritten).toHaveLength(2);
    expect(overwritten[1]).toMatchObject({
      before: { key, text: "처음 세우는 고지 문구예요." },
      after: { key, text: "약해진 고지 문구예요." }
    });
    // 봉투는 key와 text 두 칸뿐이다 — 고지는 운영이 쓴 공개 문구이고, 사용자 데이터(PII)는 없다.
    expect(Object.keys(overwritten[1]!.before!).sort()).toEqual(["key", "text"]);
    expect(Object.keys(overwritten[1]!.after!).sort()).toEqual(["key", "text"]);
  });
});
