import { HttpException, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { HouseholdRuntimeService } from "../src/households/household-runtime.service";
import { PrismaService } from "../src/prisma/prisma.service";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// See admin-settings.e2e.test.ts's login() comment: a random suffix keeps dev-login
// isolated per test run against the persistent Postgres database.
async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `${providerToken}-${randomUUID()}` })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

async function householdIdFor(app: INestApplication, accessToken: string) {
  return (
    await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
  ).body.households[0].id as string;
}

async function userIdFor(app: INestApplication, accessToken: string) {
  return (
    await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200)
  ).body.user.id as string;
}

/**
 * FIX-121A(F5) 경합 재현 도구. Prisma 모델 delegate에 vi.spyOn을 걸면 restore 후
 * 클라이언트가 망가지므로(push-dispatch.db.test.ts의 같은 주석 참고), 서비스가
 * 실제로 쓰는 delegate 메서드만 옮겨 담은 얄팍한 대역 prisma를 만든다. 지정한
 * "읽기" 메서드가 값을 돌려주기 **직전**에 `onRead`를 실행해, 서비스가 이미 읽어
 * 둔 스냅샷이 낡은 상태가 되는 실제 인터리빙을 결정적으로 만든다.
 *
 * 대역은 통과(pass-through)일 뿐이라 실제 DB에 그대로 쓰고, 수정 전/후 코드가
 * 각각 쓰는 `update`와 `updateMany`가 모두 살아 있다 — 그래서 "무슨 메서드를
 * 불렀나"가 아니라 "행이 어떤 상태로 남았나"로 회귀를 판정할 수 있다.
 */
function prismaRacingOnInviteRead(
  prisma: PrismaService,
  readMethod: "findFirst" | "findUnique",
  onRead: () => Promise<void>
): PrismaService {
  const invites = prisma.householdInvite;
  const raced: Record<string, (args: never) => Promise<unknown>> = {
    findFirst: (args) => invites.findFirst(args),
    findUnique: (args) => invites.findUnique(args),
    update: (args) => invites.update(args),
    updateMany: (args) => invites.updateMany(args)
  };

  const passthrough = raced[readMethod];
  let alreadyRaced = false;
  raced[readMethod] = async (args) => {
    const result = await passthrough(args);
    if (!alreadyRaced) {
      alreadyRaced = true;
      await onRead();
    }
    return result;
  };

  return { household: prisma.household, householdInvite: raced } as unknown as PrismaService;
}

/** 서비스를 직접 부를 때의 에러 판정 (import-parser-inference.test.ts와 같은 관례). */
async function expectRejectedWithCode(promise: Promise<unknown>, code: string) {
  const caught = await promise.then(
    () => null,
    (error: unknown) => error
  );
  expect(caught).toBeInstanceOf(HttpException);
  expect((caught as HttpException).getResponse()).toMatchObject({ code });
}

async function completeOwnerOnboarding(app: INestApplication, accessToken: string) {
  const householdId = await householdIdFor(app, accessToken);

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
        nickname: "튼튼이",
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

function tokenFromInviteUrl(inviteUrl: string) {
  const token = inviteUrl.split("/invite/")[1];
  expect(token).toBeTruthy();
  return token;
}

describe("Family invites and household RBAC", () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  it("lets an owner invite a co-parent whose expense is reflected in the same child report", async () => {
    const ownerToken = await login(app, "batch08-owner");
    const { householdId, childId } = await completeOwnerOnboarding(app, ownerToken);

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.members).toEqual([
          expect.objectContaining({
            householdId,
            role: "owner",
            status: "active"
          })
        ]);
      });

    const inviteResponse = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);

    expect(inviteResponse.body).toMatchObject({
      inviteUrl: expect.stringContaining("/invite/"),
      expiresAt: expect.any(String)
    });
    const inviteToken = tokenFromInviteUrl(inviteResponse.body.inviteUrl);

    await request(app.getHttpServer())
      .get(`/api/v1/invites/${inviteToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          householdName: "우리 가족",
          role: "co_parent",
          expiresAt: inviteResponse.body.expiresAt
        });
      });

    const coParentToken = await login(app, "batch08-co-parent");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.household).toMatchObject({
          id: householdId,
          name: "우리 가족",
          role: "co_parent"
        });
      });

    await request(app.getHttpServer())
      .get("/api/v1/children")
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.children).toEqual([expect.objectContaining({ id: childId })]);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .send({
        categoryId,
        amountKrw: 42000,
        spentOn: "2026-07-06",
        itemName: "공동부모 기저귀",
        paymentMethod: "card"
      })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(42000);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(403);
  });

  it("rejects an existing active member re-accepting an invite instead of overwriting their role (owner lockout regression)", async () => {
    const ownerToken = await login(app, "batch08-self-invite-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);

    const viewerInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(viewerInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe("HOUSEHOLD_ALREADY_MEMBER");
      });

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.members).toEqual([
          expect.objectContaining({ householdId, role: "owner", status: "active" })
        ]);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);
  });

  it("allows viewer report access but blocks viewer expense writes and invite creation", async () => {
    const ownerToken = await login(app, "batch08-viewer-owner");
    const { householdId, childId } = await completeOwnerOnboarding(app, ownerToken);
    const viewerInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);

    const viewerToken = await login(app, "batch08-viewer");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(viewerInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.household.role).toBe("viewer");
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        categoryId,
        amountKrw: 12000,
        spentOn: "2026-07-06",
        itemName: "viewer blocked",
        paymentMethod: "card"
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(403);
  });

  it("lists only still-usable pending invites for the owner and never re-exposes the invite token", async () => {
    const ownerToken = await login(app, "fam121b-list-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.invites).toEqual([]);
      });

    const coParentInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);
    const viewerInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);

    const listed = (
      await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}/invites`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.invites as Array<Record<string, unknown>>;

    expect(listed).toHaveLength(2);
    expect(listed.map((invite) => invite.role).sort()).toEqual(["co_parent", "viewer"]);
    for (const invite of listed) {
      expect(invite).toMatchObject({
        householdId,
        status: "pending",
        channel: "link",
        canReshareLink: false,
        expiresAt: expect.any(String),
        createdAt: expect.any(String)
      });
      // The plaintext token only ever exists in the create response; the row keeps a
      // sha256 hash, so the listing must not leak a token, a hash, or a usable link.
      const serialized = JSON.stringify(invite);
      expect(serialized).not.toContain("/invite/");
      expect(serialized.toLowerCase()).not.toContain("token");
      expect(serialized).not.toContain(tokenFromInviteUrl(coParentInvite.body.inviteUrl));
      expect(serialized).not.toContain(tokenFromInviteUrl(viewerInvite.body.inviteUrl));
    }

    // An accepted invite drops out of the pending listing.
    const coParentToken = await login(app, "fam121b-list-co-parent");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(coParentInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.invites.map((invite: { role: string }) => invite.role)).toEqual(["viewer"]);
      });

    // Non-owner members cannot see the household's pending invites.
    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(403);

    const outsiderToken = await login(app, "fam121b-list-outsider");
    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it("lets an owner cancel a pending invite, which then stops working and disappears from the listing", async () => {
    const ownerToken = await login(app, "fam121b-cancel-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);

    const invite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);
    const inviteToken = tokenFromInviteUrl(invite.body.inviteUrl);

    const inviteId = (
      await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}/invites`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.invites[0].id as string;

    const otherOwnerToken = await login(app, "fam121b-cancel-other-owner");
    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/invites/${inviteId}`)
      .set("Authorization", `Bearer ${otherOwnerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/invites/00000000-0000-4000-8000-000000000000`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_FOUND");
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/invites/${inviteId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.invites).toEqual([]);
      });

    // The cancelled link is dead for both preview and acceptance.
    await request(app.getHttpServer())
      .get(`/api/v1/invites/${inviteToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_PENDING");
      });

    const inviteeToken = await login(app, "fam121b-cancel-invitee");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${inviteeToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_PENDING");
      });

    // Cancelling twice is rejected rather than silently succeeding.
    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/invites/${inviteId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_PENDING");
      });
  });

  /**
   * FIX-121A(F5) 회귀. cancelInvite의 lazy-expiry는 원래 무조건 `update({ where: { id } })`
   * 였다 — 초대를 pending으로 읽은 직후 acceptInvite의 CAS가 커밋되면, 이미
   * `accepted`가 된(= 멤버십까지 생긴) 행을 `expired`로 덮어썼다. "TTL이 막 지난
   * 초대를 취소한다"가 정확히 이 분기를 타는 시점이라 가설상의 창이 아니다.
   *
   * 아래는 그 인터리빙을 결정적으로 재현한다: cancelInvite의 읽기가 값을 돌려주기
   * 직전에 acceptInvite와 동일한 CAS(pending -> accepted)를 커밋시킨 뒤, 실제 DB
   * 행이 어떤 상태로 남는지로 판정한다. 수정 전에는 `expired`로 덮였고, 수정 후에는
   * 같은 `updateMany({ where: { id, status: "pending" } })` CAS라 0건이 되어
   * `accepted`가 살아남는다(호출자는 그대로 INVITE_NOT_PENDING).
   */
  it("FIX-121A(F5): 만료 표시가 동시에 수락된 초대를 덮어쓰지 않는다 (cancelInvite)", async () => {
    const ownerToken = await login(app, "fix121a-race-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);
    const ownerUserId = await userIdFor(app, ownerToken);
    const inviteeUserId = await userIdFor(app, await login(app, "fix121a-race-invitee"));

    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);

    const prisma = app.get(PrismaService);
    const runtime = app.get(HouseholdRuntimeService);
    const invite = await prisma.householdInvite.findFirstOrThrow({ where: { householdId, status: "pending" } });

    // TTL이 막 지난 상태 — cancelInvite가 lazy-expiry 분기를 타게 만든다.
    // `chk_household_invites_expiry (expires_at > created_at)` 때문에 생성 시각도 함께 과거로.
    await prisma.householdInvite.update({
      where: { id: invite.id },
      data: { createdAt: new Date(Date.now() - 2_000), expiresAt: new Date(Date.now() - 1_000) }
    });

    const racingRuntime = new HouseholdRuntimeService(
      prismaRacingOnInviteRead(prisma, "findFirst", async () => {
        // acceptInvite가 트랜잭션 첫 문장으로 수행하는 CAS 그대로.
        const claimed = await prisma.householdInvite.updateMany({
          where: { id: invite.id, status: "pending" },
          data: { status: "accepted", acceptedByUserId: inviteeUserId, acceptedAt: new Date() }
        });
        expect(claimed.count).toBe(1);
      })
    );

    const owner = await runtime.enrichUser({
      id: ownerUserId,
      displayName: "owner",
      email: null,
      status: "active",
      households: []
    });

    await expectRejectedWithCode(racingRuntime.cancelInvite(owner, householdId, invite.id), "INVITE_NOT_PENDING");

    // 핵심 단언: 수락 결과가 살아 있어야 한다. 덮어썼다면 "멤버십은 생겼는데
    // 초대는 만료"라는 모순 상태가 남는다.
    const after = await prisma.householdInvite.findFirstOrThrow({ where: { id: invite.id } });
    expect(after.status).toBe("accepted");
    expect(after.acceptedByUserId).toBe(inviteeUserId);
  });

  /**
   * 같은 lazy-expiry 패턴을 쓰는 나머지 경로를 통일했는지 고정한다.
   * `requirePendingInvite`(getInvite/acceptInvite의 사전 조회)도 무조건 update였다.
   * listInvites는 처음부터 `updateMany({ status: "pending" })` CAS라 기준 형태다.
   */
  it("FIX-121A(F5): 초대 조회의 lazy-expiry도 같은 CAS라 accepted를 덮지 않는다", async () => {
    const ownerToken = await login(app, "fix121a-race2-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);
    const inviteeUserId = await userIdFor(app, await login(app, "fix121a-race2-invitee"));

    const created = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);
    const inviteToken = tokenFromInviteUrl(created.body.inviteUrl);

    const prisma = app.get(PrismaService);
    const invite = await prisma.householdInvite.findFirstOrThrow({ where: { householdId, status: "pending" } });
    await prisma.householdInvite.update({
      where: { id: invite.id },
      data: { createdAt: new Date(Date.now() - 2_000), expiresAt: new Date(Date.now() - 1_000) }
    });

    const racingRuntime = new HouseholdRuntimeService(
      prismaRacingOnInviteRead(prisma, "findUnique", async () => {
        await prisma.householdInvite.updateMany({
          where: { id: invite.id, status: "pending" },
          data: { status: "accepted", acceptedByUserId: inviteeUserId, acceptedAt: new Date() }
        });
      })
    );

    await expectRejectedWithCode(racingRuntime.getInvite(inviteToken), "INVITE_NOT_PENDING");

    const after = await prisma.householdInvite.findFirstOrThrow({ where: { id: invite.id } });
    expect(after.status).toBe("accepted");
  });

  it("lets an owner force-remove a member; blocks non-owners and self-removal, and revokes access", async () => {
    const ownerToken = await login(app, "batch08-remove-owner");
    const { householdId, childId } = await completeOwnerOnboarding(app, ownerToken);

    const coParentInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);
    const coParentToken = await login(app, "batch08-remove-co-parent");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(coParentInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(200);

    const viewerInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);
    const viewerToken = await login(app, "batch08-remove-viewer");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(viewerInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    const membersBefore = (
      await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}/members`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.members as Array<{ id: string; role: string }>;

    const ownerMemberId = membersBefore.find((member) => member.role === "owner")!.id;
    const coParentMemberId = membersBefore.find((member) => member.role === "co_parent")!.id;
    const viewerMemberId = membersBefore.find((member) => member.role === "viewer")!.id;

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/${viewerMemberId}`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/${coParentMemberId}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/${ownerMemberId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("HOUSEHOLD_MEMBER_REMOVE_OWNER_FORBIDDEN");
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/00000000-0000-4000-8000-000000000000`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/${coParentMemberId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.members.map((member: { id: string }) => member.id)).not.toContain(coParentMemberId);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .send({
        categoryId,
        amountKrw: 10000,
        spentOn: "2026-07-06",
        itemName: "removed member blocked",
        paymentMethod: "card"
      })
      .expect(403);
  });
});
